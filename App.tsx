
import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ShoppingBag, Play, Sword, Swords, Home, Orbit, Shield, Sparkles, Crosshair, Zap, Heart } from 'lucide-react';
import { GameScene } from './components/Scene3D';
import type { BattleActionsConfig } from './components/scene3d/BattleActionsHtml';
import { OpeningScreen } from './components/OpeningScreen';
import { ClassSelectionScreen } from './components/ClassSelectionScreen';
import { BattleHUD, MenuScreen, ShopScreen, TavernScreen, CardChoiceScreen, DungeonResultScreen, BossVictoryModal } from './components/GameUI';
import { HeroProfileDetailModal } from './components/scene3d/HeroInspectCanvas';
import { useInputMode } from './game/hooks/useInputMode';
import { AdminPanel } from './components/AdminPanel';
import { AlchemistScreen } from './components/shop/AlchemistMenuScreen';
import { 
    Player, Enemy, EnemyIntentPreview, GameState, TurnState, BattleLog, Item, Skill, Stats, Particle, FloatingText, ProgressionCard, CardRewardOffer, AlchemistCardOffer, AlchemistItemOffer, DungeonRunState, DungeonResult, DungeonRewards, EnemyTemplate, DungeonEnemyTemplate, DungeonBossTemplate, PlayerAnimationAction, BossVictoryContext, CardCategory, GltfMonsterBodyType, PlayerClassId, PendingTargetAction, BattleTimelineState, TipoDefesa, Mission, MissionActionType
} from './types';
import { INITIAL_MISSIONS } from './game/data/missions';
import { 
    INITIAL_PLAYER, SHOP_ITEMS, ALL_ITEMS, MATERIALS, SKILLS, ENEMY_DATA, ENEMY_COLORS, DUNGEON_ENEMY_DATA, DUNGEON_BOSS, ALCHEMIST_ITEM_OFFERS 
} from './constants';
import { PROGRESSION_CARDS, ALCHEMIST_CARDS } from './game/data/cards';
import { applyPlayerClass, getPlayerClassById, PLAYER_CLASSES } from './game/data/classes';
import { gameMusicManager, isNightTime, type MusicTrackId } from './game/audio/music';
import { battleSfx } from './game/audio/sfx';
import { uiSfx } from './game/audio/uiSfx';
import { createEmptyBuffState, consumeTurnBuffs } from './game/mechanics/combat';
import { createClassResourceState, getTalentBonuses, getUnlockedResourceMax, resetTalentNodes, syncPlayerConstellationSkills, unlockTalentNode } from './game/mechanics/classProgression';
import { buyItemForPlayer, sellItemFromPlayer } from './game/mechanics/inventory';
import { applyEquipmentBonusesToStats } from './game/mechanics/equipmentBonuses';
import { warmupBattleRuntimeAssets } from './game/mechanics/assetWarmup';
import { WeaponProficiencyAppliedBonuses, applyWeaponProficiencyBonusesToStats, getWeaponProficiencyAppliedBonuses, shouldUseMagicBasicAttack, shouldUseBowBasicAttack } from './game/mechanics/weaponProficiency';
import { SavePayload, SaveSlotId, SaveSlotSummary, getActiveSaveSlotId, listSaveSlots, loadSaveFromSlot, saveToActiveSlot, setActiveSaveSlotId, clearSlot } from './game/mechanics/saveSystem';
import { useBattleController } from './game/hooks/useBattleController';
import { useBattleResolution } from './game/hooks/useBattleResolution';
import { useBattleTimeline, type BattleTimelineActor } from './game/hooks/useBattleTimeline';
import { initInputManager, onAction, getInputState } from './game/mechanics/inputManager';
import { PF } from './game/data/promptFont';
import { GamepadHint } from './components/ui/GamepadHint';
import { GamepadIndicator } from './components/ui/GamepadIndicator';
import { GamepadActionLegend } from './components/ui/GamepadActionLegend';
import { MissionToast, type MissionToastItem } from './components/ui/MissionToast';
import { generateBattleDescription, generateVictorySpeech } from './services/battleNarrationService';
import { TowerRunState, TowerMeta, TowerNode, TowerNodeType, TowerSanctuaryOption, TowerEventOption, RunCard, ConsumableSlot } from './types';
import { DEFAULT_TOWER_META, TOWER_CONSUMABLE_UPGRADE_COST, getClassSlots } from './constants';
import { TowerHubScreen } from './components/tower/TowerHubScreen';
import { TowerMapScreen } from './components/tower/TowerMapScreen';
import { TowerSanctuaryScreen } from './components/tower/TowerSanctuaryScreen';
import { TowerResultScreen } from './components/tower/TowerResultScreen';
import { buildTowerRunState, getDefaultTowerMeta, resolveTowerDeath, completeNode, getSanctuaryOptions, getRunCardOffer, getTowerShopItems, advanceToNextFloor, calculateEssenceReward, applyTowerRunRewardsToPlayer, scaleEnemyForTower } from './game/mechanics/towerEngine';
import { TOWER_RUN_CARDS, TOWER_EVENTS } from './game/data/tower';
import { getDefaultRenderQualityPreset, type RenderQualityPreset } from './components/scene3d/environment';
import { GLTF_MONSTER_BESTIARY, getGltfMonsterPoolForStage } from './game/data/gltfMonsters';

const DeveloperConsole = React.lazy(async () => ({
    default: (await import('./components/DeveloperConsole')).DeveloperConsole,
}));

type BootWindow = Window & { __heroAdventureBootReady?: boolean };
const MENU_CAMERA_TRANSITION_MS = 2500;
const PORTAL_TRAVEL_CAMERA_ZOOM_MS = 720;
type SceneRegion = 'forest' | 'dungeon' | 'tower';
type OnboardingPhase = 'intro_camp' | 'post_first_hunt' | 'inventory_prompt' | 'inventory_unlocked' | 'missions_prompt' | 'missions_unlocked' | 'cards_prompt' | 'cards_unlocked' | 'merchant_prompt' | 'merchant_unlocked' | 'items_prompt' | 'flee_prompt' | 'flee_unlocked' | 'dungeon_prompt' | 'dungeon_unlocked' | 'alchemist_prompt' | 'alchemist_unlocked';

const ONBOARDING_PHASES: OnboardingPhase[] = [
    'intro_camp',
    'post_first_hunt',
    'inventory_prompt',
    'inventory_unlocked',
    'missions_prompt',
    'missions_unlocked',
    'cards_prompt',
    'cards_unlocked',
    'merchant_prompt',
    'merchant_unlocked',
    'items_prompt',
    'flee_prompt',
    'flee_unlocked',
    'dungeon_prompt',
    'dungeon_unlocked',
    'alchemist_prompt',
    'alchemist_unlocked',
];
const IMPULSE_UNLOCK_LEVELS = [4, 8, 12] as const;
const getImpulseCapacityByLevel = (level: number) => (
    level >= 12 ? 3 : level >= 8 ? 2 : level >= 4 ? 1 : 0
);
const XP_TO_NEXT_BASE = 150;
const XP_TO_NEXT_GROWTH = 1.5;
const getXpToNextByLevel = (level: number) => {
    const safeLevel = Math.max(1, Math.floor(level));
    let xpToNext = XP_TO_NEXT_BASE;

    for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
        xpToNext = Math.floor(xpToNext * XP_TO_NEXT_GROWTH);
    }

    return xpToNext;
};
const AUTOSAVE_DEBOUNCE_MS = 2500;
const LEGACY_WEAPON_ID_MAP: Record<string, string> = {
    wep_b1: 'wep_3d_dagger_a',
    wep_b2: 'wep_3d_axe_a',
    wep_s1: 'wep_3d_sword_b',
    wep_s2: 'wep_3d_spear_a',
    wep_g1: 'wep_3d_sword_d',
    wep_g2: 'wep_3d_sword_e',
};
const ALL_ITEMS_BY_ID = new Map(ALL_ITEMS.map((item) => [item.id, item]));
const BATTLE_SETTINGS_STORAGE_KEY = 'hero_adventure_battle_settings_v1';
const BATTLE_SETTINGS_GRAPHICS_REVISION = 2;
const MENU_BACKGROUND_IMAGE_URL = new URL('./game/assets/Imagens/Menu_Screen.png', import.meta.url).href;
const MENU_LOGO_IMAGE_URL = new URL('./game/assets/Imagens/Logo_Hero_Tower.png', import.meta.url).href;
const SAVE_THUMB_FOREST_URL = new URL('./game/assets/Scenario/Florest/cenario_thumbnail_floresta.png', import.meta.url).href;
const SAVE_THUMB_MOUNTAIN_URL = new URL('./game/assets/Scenario/Moutain/cenario_thumbnail_montanha.png', import.meta.url).href;
const SAVE_THUMB_DUNGEON_URL = new URL('./game/assets/Scenario/Dungeon/cenario_thumbnail_dungeon.png', import.meta.url).href;
const SAVE_THUMB_TOWER_URL = new URL('./game/assets/Scenario/Tower/cenario_thumbnail_torre.png', import.meta.url).href;
const SAVE_SCENE_THUMBNAIL: Record<string, string> = {
    forest: SAVE_THUMB_MOUNTAIN_URL,
    dungeon: SAVE_THUMB_DUNGEON_URL,
    tower: SAVE_THUMB_TOWER_URL,
};
const SAVE_CLASS_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
    knight: Shield,
    barbarian: Sword,
    mage: Sparkles,
    ranger: Crosshair,
    rogue: Zap,
};

const SAVE_CLASS_NAME_PT: Record<string, string> = {
    knight: 'Cavaleiro',
    barbarian: 'Bárbaro',
    mage: 'Mago',
    ranger: 'Ranger',
    rogue: 'Ladino',
};

interface BattleSettings {
    musicEnabled: boolean;
    sfxEnabled: boolean;
    renderQualityPreset: RenderQualityPreset;
    graphicsPresetRevision: number;
}

const createDefaultBattleSettings = (): BattleSettings => ({
    musicEnabled: true,
    sfxEnabled: true,
    renderQualityPreset: getDefaultRenderQualityPreset(),
    graphicsPresetRevision: BATTLE_SETTINGS_GRAPHICS_REVISION,
});

const sanitizeRenderQualityPreset = (value: unknown): RenderQualityPreset | null => {
    if (value === 'performance' || value === 'balanced' || value === 'quality') {
        return value;
    }

    return null;
};

const readBattleSettings = (): BattleSettings => {
    const defaults = createDefaultBattleSettings();
    if (typeof window === 'undefined') {
        return defaults;
    }

    try {
        const raw = window.localStorage.getItem(BATTLE_SETTINGS_STORAGE_KEY);
        if (!raw) {
            return defaults;
        }

        const parsed = JSON.parse(raw) as Partial<BattleSettings>;
        const storedRenderQualityPreset = sanitizeRenderQualityPreset(parsed.renderQualityPreset);
        const isLegacyGraphicsPreset = typeof parsed.graphicsPresetRevision !== 'number'
            || parsed.graphicsPresetRevision < BATTLE_SETTINGS_GRAPHICS_REVISION;
        const renderQualityPreset = isLegacyGraphicsPreset
            && storedRenderQualityPreset === 'quality'
            && defaults.renderQualityPreset !== 'quality'
            ? defaults.renderQualityPreset
            : storedRenderQualityPreset ?? defaults.renderQualityPreset;

        return {
            musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : defaults.musicEnabled,
            sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : defaults.sfxEnabled,
            renderQualityPreset,
            graphicsPresetRevision: BATTLE_SETTINGS_GRAPHICS_REVISION,
        };
    } catch {
        return defaults;
    }
};

const hasWeaponProficiencyBonuses = (bonuses: WeaponProficiencyAppliedBonuses) => (
    Object.values(bonuses).some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
);

const remapLegacyItemId = (itemId: string) => LEGACY_WEAPON_ID_MAP[itemId] ?? itemId;

const resolveCanonicalItemReference = (item: Item | null | undefined): Item | null => {
    if (!item) {
        return null;
    }

    const mappedId = remapLegacyItemId(item.id);
    return ALL_ITEMS_BY_ID.get(mappedId) ?? item;
};

const normalizeInventoryItemIds = (inventory: Record<string, number>): Record<string, number> => {
    const normalized: Record<string, number> = {};

    Object.entries(inventory).forEach(([itemId, quantity]) => {
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return;
        }

        const mappedId = remapLegacyItemId(itemId);
        normalized[mappedId] = (normalized[mappedId] ?? 0) + Math.floor(quantity);
    });

    return normalized;
};

const normalizeSavedPlayerForCurrentBuild = (source: Player): Player => {
    const playerClass = getPlayerClassById(source.classId);
    const shouldBackfillMagic = !Number.isFinite(source.stats.magic);
    const normalizedInventory = normalizeInventoryItemIds(source.inventory ?? {});

    const ensureEquippedVisible = (equipped: Item | null) => {
        if (!equipped) {
            return;
        }

        if ((normalizedInventory[equipped.id] ?? 0) <= 0) {
            normalizedInventory[equipped.id] = 1;
        }
    };

    let equippedWeapon = resolveCanonicalItemReference(source.equippedWeapon);
    const equippedArmor = resolveCanonicalItemReference(source.equippedArmor);
    const equippedHelmet = resolveCanonicalItemReference(source.equippedHelmet);
    const equippedLegs = resolveCanonicalItemReference(source.equippedLegs);
    const equippedShield = resolveCanonicalItemReference(source.equippedShield);

    ensureEquippedVisible(equippedWeapon);
    ensureEquippedVisible(equippedArmor);
    ensureEquippedVisible(equippedHelmet);
    ensureEquippedVisible(equippedLegs);
    ensureEquippedVisible(equippedShield);

    let normalizedStats: Stats = {
        ...source.stats,
        magic: Number.isFinite(source.stats.magic) ? source.stats.magic : playerClass.baseStats.magic,
        magicDef: Number.isFinite(source.stats.magicDef) ? source.stats.magicDef : (playerClass.baseStats.magicDef ?? source.stats.def),
    };

    if (shouldBackfillMagic && equippedWeapon) {
        const proficiencyBonuses = getWeaponProficiencyAppliedBonuses(source.classId, equippedWeapon);
        if (hasWeaponProficiencyBonuses(proficiencyBonuses)) {
            normalizedStats = applyWeaponProficiencyBonusesToStats(normalizedStats, proficiencyBonuses, 1);
        }
    }

    const maxImpulse = getImpulseCapacityByLevel(source.level);
    const expectedXpToNext = getXpToNextByLevel(source.level);
    const normalizedXpToNext = Number.isFinite(source.xpToNext)
        ? Math.max(expectedXpToNext, Math.floor(source.xpToNext))
        : expectedXpToNext;

    return {
        ...source,
        stats: normalizedStats,
        inventory: normalizedInventory,
        equippedWeapon,
        equippedArmor,
        equippedHelmet,
        equippedLegs,
        equippedShield,
        xpToNext: normalizedXpToNext,
        impulso: Math.max(0, Math.min(maxImpulse, source.impulso ?? 0)),
        impulsoAtivo: Math.max(0, Math.min(maxImpulse, source.impulsoAtivo ?? 0)),
        equippedSkillIds: (() => {
            const ids = Array.isArray((source as any).equippedSkillIds) ? (source as any).equippedSkillIds : [];
            const maxSkills = getClassSlots(source.classId).skills;
            const result: string[] = Array.from({ length: maxSkills }, () => '');
            for (let i = 0; i < maxSkills; i++) result[i] = typeof ids[i] === 'string' ? ids[i] : '';
            return result;
        })(),
        equippedItemSlots: (() => {
            const raw = Array.isArray((source as any).equippedItemSlots) ? (source as any).equippedItemSlots : [];
            const maxItems = getClassSlots(source.classId).items;
            const result: Array<{ itemId: string; qty: number }> = Array.from({ length: maxItems }, () => ({ itemId: '', qty: 0 }));
            for (let i = 0; i < maxItems; i++) {
                const s = raw[i];
                if (s && typeof s.itemId === 'string' && typeof s.qty === 'number') {
                    result[i] = { itemId: s.itemId, qty: Math.max(0, s.qty) };
                }
            }
            return result;
        })(),
    };
};

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

const GameOverScreen: React.FC<{ stage: number; onRespawn: () => void }> = ({ stage, onRespawn }) => {
    const [leaving, setLeaving] = React.useState(false);
    const handleRespawn = () => {
        if (leaving) return;
        setLeaving(true);
        setTimeout(onRespawn, 580);
    };
    return (
        <div
            className={leaving ? 'gameover-overlay-out' : 'gameover-overlay-in'}
            style={{
                position: 'absolute', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16, pointerEvents: 'auto',
                fontFamily: "'Segoe UI',system-ui,sans-serif",
            }}
        >
            <div
                className={leaving ? 'gameover-card-out' : 'gameover-card-in'}
                style={{
                    position: 'relative', zIndex: 1,
                    width: '100%', maxWidth: 520,
                    background: 'rgba(10,2,2,0.50)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(220,100,100,0.20)',
                    borderRadius: 28, overflow: 'hidden',
                    boxShadow: '0 40px 120px rgba(80,10,10,0.50)',
                }}
            >
                {/* Header */}
                <div style={{
                    background: 'rgba(100,16,16,0.42)',
                    borderBottom: '1px solid rgba(220,100,100,0.15)',
                    padding: '32px 32px 26px', textAlign: 'center', position: 'relative', overflow: 'hidden',
                }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top, rgba(255,60,60,0.10), transparent 65%)', pointerEvents: 'none' }} />
                    <div className="gameover-badge-anim" style={{
                        display: 'inline-flex', alignItems: 'center',
                        borderRadius: 99, border: '1px solid rgba(255,200,200,0.20)',
                        background: 'rgba(255,255,255,0.08)',
                        padding: '5px 16px',
                        fontSize: 10, fontWeight: 900, letterSpacing: '0.28em', textTransform: 'uppercase',
                        color: 'rgba(255,215,215,0.82)',
                    }}>Derrota</div>
                    <h1 className="gameover-title-anim" style={{
                        marginTop: 18,
                        fontSize: 'clamp(2.4rem, 6vw, 3.2rem)',
                        fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: '#ffe8e8',
                        textShadow: '0 0 48px rgba(255,70,70,0.38), 0 2px 0 rgba(0,0,0,0.5)',
                        lineHeight: 1,
                    }}>Você perdeu</h1>
                    <p className="gameover-sub-anim" style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: 'rgba(255,195,195,0.60)', letterSpacing: '0.01em' }}>
                        A batalha terminou, mas sua jornada continua.
                    </p>
                </div>
                {/* Body */}
                <div className="gameover-body-anim" style={{ padding: '22px 26px 26px' }}>
                    <div style={{
                        borderRadius: 14, border: '1px solid rgba(200,80,80,0.14)',
                        background: 'rgba(255,40,40,0.06)',
                        padding: '15px 18px', textAlign: 'center', marginBottom: 18,
                    }}>
                        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,155,155,0.55)' }}>Resumo</div>
                        <div style={{ marginTop: 6, fontSize: 19, fontWeight: 900, color: '#ffe2e2', letterSpacing: '0.03em' }}>Fase {stage}</div>
                        <p style={{ marginTop: 7, fontSize: 12, color: 'rgba(255,185,185,0.48)', lineHeight: 1.55 }}>
                            HP e mana serão restaurados ao renascer no acampamento.
                        </p>
                    </div>
                    <button
                        className="gameover-btn gameover-btn-anim"
                        onClick={handleRespawn}
                        disabled={leaving}
                        style={{
                            width: '100%', padding: '14px 20px', borderRadius: 14,
                            border: '1px solid rgba(240,175,175,0.32)',
                            background: 'linear-gradient(135deg, #efcece, #f8e6e6)',
                            color: '#6b1f1f', fontSize: 13, fontWeight: 900,
                            letterSpacing: '0.14em', textTransform: 'uppercase',
                            cursor: leaving ? 'default' : 'pointer',
                            boxShadow: '0 4px 22px rgba(200,60,60,0.16)',
                            opacity: leaving ? 0.6 : 1,
                            fontFamily: "'Segoe UI',system-ui,sans-serif",
                        }}
                    >
                        Renascer no acampamento
                    </button>
                </div>
            </div>
        </div>
    );
};

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
        isDefendendo: source.isDefendendo ?? source.isDefending ?? false,
        tipoDefesaAtiva: source.tipoDefesaAtiva ?? null,
        impulso: Math.max(0, Math.min(getImpulseCapacityByLevel(source.level), source.impulso ?? 0)),
        impulsoAtivo: Math.max(0, Math.min(getImpulseCapacityByLevel(source.level), source.impulsoAtivo ?? 0)),
        buffs: {
            ...source.buffs,
            perfectGuardTurns: source.buffs.perfectGuardTurns ?? 0,
            impulseDefenseBoostTurns: source.buffs.impulseDefenseBoostTurns ?? 0,
            guaranteedCounterTurns: source.buffs.guaranteedCounterTurns ?? 0,
            skillEmpowerTurns: source.buffs.skillEmpowerTurns ?? 0,
        },
    });

    const cloneBattleLogs = (source: BattleLog[]): BattleLog[] => source.map((entry) => ({ ...entry }));
    const cloneCardRewardOffers = (source: CardRewardOffer[]): CardRewardOffer[] => source.map((offer) => ({ ...offer }));
    const cloneProgressionCards = (source: ProgressionCard[]): ProgressionCard[] => source.map((card) => ({
        ...card,
        effects: card.effects.map((effect) => ({ ...effect })),
    }));
    const cloneDungeonRewards = (source: DungeonRewards): DungeonRewards => ({
        ...source,
        drops: { ...source.drops },
    });
    const cloneDungeonRunState = (source: DungeonRunState | null): DungeonRunState | null => {
        if (!source) {
            return null;
        }

        return {
            entrySnapshot: clonePlayer(source.entrySnapshot),
            rewards: cloneDungeonRewards(source.rewards),
            evolution: source.evolution,
        };
    };
    const cloneDungeonResultState = (source: DungeonResult | null): DungeonResult | null => {
        if (!source) {
            return null;
        }

        return {
            ...source,
            rewards: cloneDungeonRewards(source.rewards),
        };
    };
    const cloneBossVictoryContextState = (source: BossVictoryContext | null): BossVictoryContext | null => {
        if (!source) {
            return null;
        }

        return {
            ...source,
            rewards: source.rewards ? cloneDungeonRewards(source.rewards) : undefined,
        };
    };

    const getDungeonMonsterTarget = (evolution: number) => 10 + Math.floor(evolution / 3) * 10;
    const getDungeonPowerMultiplier = (evolution: number) => 1 + (evolution * 0.12);
    const getDungeonPhaseFromEvolution = (evolution: number) => Math.max(1, evolution + 1);
    const pickRandom = <T,>(entries: T[]) => entries[Math.floor(Math.random() * entries.length)];
    const shuffleEntries = <T,>(entries: T[]): T[] => {
        const shuffled = [...entries];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            const current = shuffled[index];
            shuffled[index] = shuffled[swapIndex];
            shuffled[swapIndex] = current;
        }
        return shuffled;
    };

    const isEnemyBagCompatible = <T extends { name: string }>(bag: T[], pool: T[]) => {
        if (bag.length === 0 || pool.length === 0) {
            return false;
        }

        const poolNames = new Set(pool.map(entry => entry.name));
        return bag.every(entry => poolNames.has(entry.name));
    };

    const pickFromEnemyBag = <T extends { name: string }>(pool: T[], bagRef: React.MutableRefObject<T[]>): T => {
        if (pool.length === 0) {
            throw new Error('Enemy pool is empty.');
        }

        if (!isEnemyBagCompatible(bagRef.current, pool)) {
            bagRef.current = shuffleEntries(pool);
        }

        const nextEnemy = bagRef.current.shift();
        if (nextEnemy) {
            return nextEnemy;
        }

        bagRef.current = shuffleEntries(pool);
        return bagRef.current.shift() ?? pool[0];
    };

    const pickRandomMany = <T,>(entries: T[], amount: number): T[] => {
        if (entries.length === 0 || amount <= 0) {
            return [];
        }
        const pool = [...entries];
        const picks: T[] = [];
        for (let index = 0; index < amount; index += 1) {
            if (pool.length === 0) {
                pool.push(...entries);
            }
            const pickIndex = Math.floor(Math.random() * pool.length);
            const [picked] = pool.splice(pickIndex, 1);
            if (picked !== undefined) {
                picks.push(picked);
            }
        }
        return picks;
    };
    const getStagePowerMultiplier = (currentStage: number) => {
        const safeStage = Math.max(1, currentStage);
        return 1 + ((safeStage - 1) * 0.16) + (Math.floor((safeStage - 1) / 2) * 0.06);
    };

    const resolveEnemyClassIdFromName = (name: string): Player['classId'] | null => {
        const normalizedName = name.toLowerCase();
        if (normalizedName.includes('mage') || normalizedName.includes('archmage')) return 'mage';
        if (normalizedName.includes('rogue') || normalizedName.includes('thief') || normalizedName.includes('assassin')) return 'rogue';
        if (normalizedName.includes('warrior') || normalizedName.includes('champion') || normalizedName.includes('guardian') || normalizedName.includes('overlord')) return 'knight';
        if (normalizedName.includes('ranger') || normalizedName.includes('archer') || normalizedName.includes('hunter')) return 'ranger';
        if (normalizedName.includes('barbar')) return 'barbarian';
        return null;
    };

    const pickEnemyClassId = (template: EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate): Player['classId'] => {
        if (template.enemyClassId) {
            return template.enemyClassId;
        }

        const inferredClass = resolveEnemyClassIdFromName(template.name);
        if (inferredClass) {
            return inferredClass;
        }

        const weightedPool: Array<Player['classId']> = ['knight', 'mage', 'rogue', 'ranger', 'barbarian', 'knight', 'rogue'];
        return pickRandom(weightedPool);
    };

    const ENEMY_CLASS_BASE_HP: Record<Player['classId'], number> = {
        knight: 77,
        barbarian: 87,
        mage: 48,
        ranger: 62,
        rogue: 62,
    };

    const ENEMY_CLASS_BASE_MP: Record<Player['classId'], number> = {
        knight: 18,
        barbarian: 16,
        mage: 40,
        ranger: 24,
        rogue: 24,
    };

    const ENEMY_CLASS_BASE_SPEED_FLOOR: Record<Player['classId'], number> = {
        knight: 12,
        barbarian: 8,
        mage: 16,
        ranger: 16,
        rogue: 20,
    };

    const ENEMY_CLASS_BASE_ATK_FLOOR: Record<Player['classId'], number> = {
        knight: 16,
        barbarian: 20,
        mage: 14,
        ranger: 16,
        rogue: 14,
    };

    const ENEMY_CLASS_BASE_DEF: Record<Player['classId'], number> = {
        knight: 8,
        barbarian: 6,
        mage: 3,
        ranger: 8,
        rogue: 6,
    };

    const ENEMY_CLASS_BASE_MAGIC_FLOOR: Record<Player['classId'], number> = {
        knight: 6,
        barbarian: 10,
        mage: 20,
        ranger: 14,
        rogue: 14,
    };

    const ENEMY_CLASS_BASE_MAGIC_DEF_FLOOR: Record<Player['classId'], number> = {
        knight: 6,
        barbarian: 3,
        mage: 16,
        ranger: 8,
        rogue: 8,
    };

    const ENEMY_CLASS_BASE_LUCK: Record<Player['classId'], number> = {
        knight: 1,
        barbarian: 1,
        mage: 2,
        ranger: 2,
        rogue: 3,
    };

    const getEnemyClassBaseHp = (enemyClassId: Player['classId']) => ENEMY_CLASS_BASE_HP[enemyClassId];
    const getEnemyClassBaseMp = (enemyClassId: Player['classId']) => ENEMY_CLASS_BASE_MP[enemyClassId];
    const getEnemyClassBaseSpeedFloor = (enemyClassId: Player['classId']) => ENEMY_CLASS_BASE_SPEED_FLOOR[enemyClassId];
    const getEnemyClassBaseAtkFloor = (enemyClassId: Player['classId']) => ENEMY_CLASS_BASE_ATK_FLOOR[enemyClassId];
    const getEnemyClassBaseDef = (enemyClassId: Player['classId']) => ENEMY_CLASS_BASE_DEF[enemyClassId];
    const getEnemyClassBaseMagicFloor = (enemyClassId: Player['classId']) => ENEMY_CLASS_BASE_MAGIC_FLOOR[enemyClassId];
    const getEnemyClassBaseMagicDefFloor = (enemyClassId: Player['classId']) => ENEMY_CLASS_BASE_MAGIC_DEF_FLOOR[enemyClassId];
    const getEnemyClassBaseLuck = (enemyClassId: Player['classId']) => ENEMY_CLASS_BASE_LUCK[enemyClassId];

    const createEnemySkillSet = (enemyClassId: Player['classId'], tier: number, cycleStrength: number): Enemy['skillSet'] => {
        const skills: Enemy['skillSet'] = [];
        const hasTier1Skill = tier >= 1;
        const hasTier2Skill = tier >= 3;

        if (enemyClassId === 'mage') {
            if (hasTier1Skill) {
                skills.push({
                    id: 'enemy_mage_arcane_blast',
                    name: 'Explosao Arcana',
                    type: 'magic',
                    effect: 'damage',
                    attackKind: 'magic',
                    damageMultiplier: 1.26 + (cycleStrength * 0.14),
                    manaCost: 12 + (cycleStrength * 2),
                    cooldown: 2,
                    currentCooldown: 0,
                });
            }
            if (hasTier2Skill) {
                skills.push({
                    id: 'enemy_mage_arcane_mend',
                    name: 'Mend Arcano',
                    type: 'heal',
                    effect: 'heal',
                    attackKind: 'magic',
                    damageMultiplier: 0,
                    healMultiplier: 0.2 + (cycleStrength * 0.03),
                    manaCost: 16 + (cycleStrength * 2),
                    cooldown: 3,
                    currentCooldown: 0,
                });
            }
            return skills;
        }

        if (enemyClassId === 'knight') {
            if (hasTier1Skill) {
                skills.push({
                    id: 'enemy_knight_shield_bash',
                    name: 'Golpe de Escudo',
                    type: 'special',
                    effect: 'damage',
                    attackKind: 'physical',
                    damageMultiplier: 1.2 + (cycleStrength * 0.1),
                    manaCost: 10 + (cycleStrength * 2),
                    cooldown: 2,
                    currentCooldown: 0,
                });
            }
            if (hasTier2Skill) {
                skills.push({
                    id: 'enemy_knight_fortress_stance',
                    name: 'Postura de Fortaleza',
                    type: 'buff',
                    effect: 'buff_def',
                    attackKind: 'physical',
                    damageMultiplier: 0,
                    buffModifier: 0.22 + (cycleStrength * 0.04),
                    buffDuration: 2,
                    manaCost: 14 + (cycleStrength * 2),
                    cooldown: 3,
                    currentCooldown: 0,
                });
            }
            return skills;
        }

        if (enemyClassId === 'rogue') {
            if (hasTier1Skill) {
                skills.push({
                    id: 'enemy_rogue_rupture',
                    name: 'Golpe de Ruptura',
                    type: 'special',
                    effect: 'damage',
                    attackKind: 'physical',
                    damageMultiplier: 1.34 + (cycleStrength * 0.12),
                    manaCost: 12 + (cycleStrength * 3),
                    cooldown: 2,
                    currentCooldown: 0,
                });
            }
            if (hasTier2Skill) {
                skills.push({
                    id: 'enemy_rogue_smoke_focus',
                    name: 'Foco da Sombra',
                    type: 'buff',
                    effect: 'buff_atk',
                    attackKind: 'physical',
                    damageMultiplier: 0,
                    buffModifier: 0.2 + (cycleStrength * 0.04),
                    buffDuration: 2,
                    manaCost: 14 + (cycleStrength * 2),
                    cooldown: 3,
                    currentCooldown: 0,
                });
            }
            return skills;
        }

        if (enemyClassId === 'barbarian') {
            if (hasTier1Skill) {
                skills.push({
                    id: 'enemy_barbarian_war_cry',
                    name: 'Grito de Guerra',
                    type: 'buff',
                    effect: 'buff_atk',
                    attackKind: 'physical',
                    damageMultiplier: 0,
                    buffModifier: 0.24 + (cycleStrength * 0.05),
                    buffDuration: 2,
                    manaCost: 10 + (cycleStrength * 2),
                    cooldown: 3,
                    currentCooldown: 0,
                });
            }
            if (hasTier2Skill) {
                skills.push({
                    id: 'enemy_barbarian_cleave',
                    name: 'Cutilada Furiosa',
                    type: 'special',
                    effect: 'damage',
                    attackKind: 'physical',
                    damageMultiplier: 1.5 + (cycleStrength * 0.13),
                    manaCost: 16 + (cycleStrength * 3),
                    cooldown: 3,
                    currentCooldown: 0,
                });
            }
            return skills;
        }

        if (hasTier1Skill) {
            skills.push({
                id: 'enemy_ranger_piercing_arrow',
                name: 'Flecha Perfurante',
                type: 'special',
                effect: 'damage',
                attackKind: 'physical',
                damageMultiplier: 1.24 + (cycleStrength * 0.11),
                manaCost: 10 + (cycleStrength * 2),
                cooldown: 2,
                currentCooldown: 0,
            });
        }
        if (hasTier2Skill) {
            skills.push({
                id: 'enemy_ranger_hawkeye_focus',
                name: 'Foco de Falcao',
                type: 'buff',
                effect: 'buff_atk',
                attackKind: 'physical',
                damageMultiplier: 0,
                buffModifier: 0.18 + (cycleStrength * 0.04),
                buffDuration: 2,
                manaCost: 12 + (cycleStrength * 2),
                cooldown: 3,
                currentCooldown: 0,
            });
        }
        return skills;
    };

    const createEnemyCombatProfile = (enemyClassId: Player['classId'], currentStage: number, isBoss: boolean, isDungeonEncounter: boolean, evolution: number) => {
        const tierBase = Math.max(0, Math.floor((Math.max(1, currentStage) - 1) / 2));
        const tierWithMode = tierBase + (isDungeonEncounter ? Math.floor(evolution / 2) : 0) + (isBoss ? 1 : 0);
        const tier = Math.max(0, tierWithMode);
        // Enemy mechanics (skills/patterns) evolve every 3 phases in hunt and dungeon.
        const mechanicTierBase = Math.max(0, Math.floor((Math.max(1, currentStage) - 1) / 3));
        const mechanicTierWithMode = mechanicTierBase + (isDungeonEncounter ? Math.floor(evolution / 3) : 0) + (isBoss ? 1 : 0);
        const mechanicTier = Math.max(0, mechanicTierWithMode);
        const cycleStrength = mechanicTier <= 0 ? 0 : Math.floor((mechanicTier - 1) / 3);
        const cycleStep = mechanicTier <= 0 ? 0 : ((mechanicTier - 1) % 3);
        const potionCharges = tier === 0 ? 0 : (isBoss ? 2 : 1);
        const potionHealValue = currentStage >= 15 ? 220 : currentStage >= 8 ? 100 : currentStage >= 3 ? 50 : 25;
        const classMpBase: Record<Player['classId'], number> = {
            knight: 18,
            barbarian: 16,
            mage: 28,
            ranger: 20,
            rogue: 22,
        };
        const maxMp = classMpBase[enemyClassId] + (tier * 4) + (isBoss ? 12 : 0);
        const manaRegenBaseByClass: Record<Player['classId'], number> = {
            knight: 3,
            mage: 5,
            rogue: 4,
            ranger: 4,
            barbarian: 2,
        };
        const manaRegenOnDefend = manaRegenBaseByClass[enemyClassId] + Math.floor(tier * 1.2) + (isBoss ? 1 : 0);
        const classDefendBonus: Record<Player['classId'], number> = {
            knight: 0.08,
            barbarian: -0.02,
            mage: 0,
            ranger: -0.01,
            rogue: -0.03,
        };

        return {
            tier,
            cycleStrength,
            potionCharges,
            potionHealValue,
            maxMp,
            manaRegenOnDefend,
            critChanceBonus: Math.min(0.24, (tier * 0.015) + (isBoss ? 0.035 : 0)),
            critDamageBonus: Math.min(0.5, (tier * 0.03) + (isBoss ? 0.08 : 0)),
            skillSet: createEnemySkillSet(enemyClassId, mechanicTier, cycleStrength),
            lowHpThreshold: enemyClassId === 'mage' ? 0.58 : enemyClassId === 'knight' ? 0.52 : 0.48,
            criticalHpThreshold: 0.25,
            lowManaThreshold: enemyClassId === 'mage' ? 0.35 : 0.25,
            defendBaseChance: Math.max(0.02, 0.08 + (cycleStep === 2 ? 0.04 : 0) + classDefendBonus[enemyClassId]),
        };
    };

    const createEmptyDungeonRewards = (evolution: number): DungeonRewards => ({
        gold: 0,
        xp: 0,
        diamonds: 0,
        drops: {},
        clearedMonsters: 0,
        totalMonsters: getDungeonMonsterTarget(evolution),
        evolution,
        bossDefeated: false,
        subBossDefeatedInPhase: dungeonSubBossDefeatedEvolution === evolution,
    });

  const [gameState, setGameState] = useState<GameState>(GameState.TAVERN);
  const [turnState, setTurnState] = useState<TurnState>(TurnState.PLAYER_INPUT);

  // ── Input system — inicializa no root para que o controle funcione em todas as telas ──
  useEffect(() => {
    return initInputManager();
  }, []);

  // ── Modo de input reativo (para hints de botão) ──
  const { uiProfile: menuUiProfile, gamepadBrand: menuGamepadBrand } = useInputMode();

  // ── Gamepad → menu de save slots ───────────────────────────────────────────
  // ⚠️ Deve estar ANTES dos refs que usam setSaveMenuFocusIdx (evita TDZ)
  const [saveMenuFocusIdx, setSaveMenuFocusIdx] = useState(0);

  // Refs sempre frescos para não precisar re-assinar o handler
  const isBootReadyRef          = useRef(false);
  const hasSavePromptRef        = useRef(false);
  const hasConfirmedClassRef    = useRef(false);
  const saveMenuFocusRef        = useRef(0);
  const saveMenuSlotsRef        = useRef<SaveSlotSummary[]>([]);
  const canCreateNewSaveRef     = useRef(false);
  const setSaveMenuFocusIdxRef  = useRef(setSaveMenuFocusIdx);
  const handleNewGameFromSlotRef= useRef<() => void>(() => {});
  const showSlotContinueModalRef     = useRef(false);
  const modalCloseRef               = useRef<() => void>(() => {});
  const modalConfirmRef             = useRef<() => void>(() => {});
  const showClearSaveConfirmModalRef = useRef(false);
  const clearModalCloseRef          = useRef<() => void>(() => {});
  const clearModalConfirmRef        = useRef<() => void>(() => {});
  const canDesfazarRef              = useRef(false);
  const openClearModalRef           = useRef<() => void>(() => {});
  const setSelectedSaveSlotIdRef    = useRef<(id: SaveSlotId) => void>(() => {});
  const menuUiProfileRef            = useRef<string>(menuUiProfile);
  const clearHoldProgressRef        = useRef(0);
  const slotHoldProgressRef         = useRef(0);
  menuUiProfileRef.current = menuUiProfile;
  setSaveMenuFocusIdxRef.current = setSaveMenuFocusIdx;

  // Sincroniza refs com estado atual (atualizado a cada render)
  useEffect(() => { isBootReadyRef.current = isBootReady; });
  useEffect(() => { hasSavePromptRef.current = hasSavePromptDecision; });

  useEffect(() => {
    return onAction((action) => {
      // Só age na tela de save slots
      if (!isBootReadyRef.current) return;
      if (hasSavePromptRef.current) return;
      if (hasConfirmedClassRef.current) return;

      // ── Modal aberto → foco vai para o modal, não para a lista de slots ──
      if (showSlotContinueModalRef.current) {
        // No modo gamepad, CONFIRM é segurar o botão — tratado pelo RAF de hold
        if (action === 'CONFIRM' && menuUiProfileRef.current !== 'gamepad') { modalConfirmRef.current(); }
        if (action === 'BACK')    { modalCloseRef.current(); }
        return;
      }
      if (showClearSaveConfirmModalRef.current) {
        // No modo gamepad, CONFIRM é segurar o botão — tratado pelo RAF de hold
        if (action === 'CONFIRM' && menuUiProfileRef.current !== 'gamepad') { clearModalConfirmRef.current(); }
        if (action === 'BACK')    { clearModalCloseRef.current(); }
        return;
      }

      const slots = saveMenuSlotsRef.current;
      const canNew = canCreateNewSaveRef.current;
      const canDesfazar = canDesfazarRef.current;
      // Itens navegáveis: slots existentes + (Novo Jogo se disponível) + (Desfazer se todos os slots cheios)
      const itemCount = slots.length + (canNew ? 1 : 0) + (!canNew && canDesfazar ? 1 : 0);
      if (itemCount === 0) return;

      if (action === 'NAV_UP' || action === 'NAV_LEFT') {
        setSaveMenuFocusIdxRef.current(prev => (prev - 1 + itemCount) % itemCount);
        uiSfx.play('click_in');
        return;
      }
      if (action === 'NAV_DOWN' || action === 'NAV_RIGHT') {
        setSaveMenuFocusIdxRef.current(prev => (prev + 1) % itemCount);
        uiSfx.play('click_in');
        return;
      }
      if (action === 'CONFIRM') {
        const idx = saveMenuFocusRef.current;
        if (idx < slots.length) {
          // Slot existente — abre modal de continuar
          const slot = slots[idx];
          if (!slot) return;
          uiSfx.play('modal_open');
          setSelectedSaveSlotId(slot.slotId);
          setActiveSaveSlotId(slot.slotId);
          setPendingContinueSlot(slot);
          setShowSlotContinueModal(true);
          requestAnimationFrame(() => setSlotContinueModalVisible(true));
        } else if (canNew) {
          // Último item = Novo Jogo
          uiSfx.play('confirm_hunt_dungeon');
          handleNewGameFromSlotRef.current();
        } else if (canDesfazar) {
          // Último item = Desfazer save
          uiSfx.play('modal_open');
          openClearModalRef.current();
        }
        return;
      }
      if (action === 'SKILL_2') {
        // Y / Triângulo — abre modal de desfazer para o slot focado
        const idx = saveMenuFocusRef.current;
        if (idx < slots.length) {
          const slot = slots[idx];
          if (!slot) return;
          uiSfx.play('modal_open');
          setSelectedSaveSlotIdRef.current(slot.slotId);
          openClearModalRef.current();
        }
        return;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ativa o painel de admin quando a URL contém ?admin=true */
  const isAdminMode = useMemo(() => new URLSearchParams(window.location.search).get('admin') === 'true', []);
    const [player, setPlayer] = useState<Player>(() => clonePlayer(INITIAL_PLAYER));
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  // Multi-enemy group combat
  const [additionalEnemies, setAdditionalEnemies] = useState<Enemy[]>([]);
  const [pendingTargetAction, setPendingTargetAction] = useState<PendingTargetAction>(null);
  const [targetCardLeaving, setTargetCardLeaving] = useState(false);
  const [showHeroDetailModal, setShowHeroDetailModal] = useState(false);
    const [isBattleSettingsModalOpen, setIsBattleSettingsModalOpen] = useState(false);
  const { uiProfile: appUiProfile } = useInputMode();
  const [accumulatedGroupRewards, setAccumulatedGroupRewards] = useState<{ gold: number; xp: number }>({ gold: 0, xp: 0 });
    const [battleTimelineState, setBattleTimelineState] = useState<BattleTimelineState>('RUNNING');
    const [activeBattleActorId, setActiveBattleActorId] = useState<string | null>(null);
  const [primaryEnemyId, setPrimaryEnemyId] = useState<string | null>(null); // player's chosen target
  /** Slot de layout ocupado pelo inimigo principal (0=centro, 1=direita, 2=mais direita). Evita teleporte visual ao selecionar alvo. */
  const [mainEnemySlotIndex, setMainEnemySlotIndex] = useState<number>(0);
  /** Mapeamento estável id → slot visual. Definido no spawn, nunca reordenado. */
  const [enemySlotAssignments, setEnemySlotAssignments] = useState<Record<string, number>>({});
  /** Tamanho inicial do grupo (1, 2 ou 3). Usado para escolher layout fixo — inimigos não se mexem quando outro morre. */
  const [initialGroupSize, setInitialGroupSize] = useState<number>(1);
  const [enemyIntentPreview, setEnemyIntentPreview] = useState<EnemyIntentPreview | null>(null);
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [narration, setNarration] = useState<string>("");
  
    const [stage, setStage] = useState(1);
    const [killCount, setKillCount] = useState(0); // Track kills in current stage
    const [dungeonEvolution, setDungeonEvolution] = useState(0);
    const [dungeonSubBossDefeatedEvolution, setDungeonSubBossDefeatedEvolution] = useState<number | null>(null);

    const getHuntPhaseLength = useCallback((currentStage: number) => {
            const safeStage = Math.max(1, currentStage);
            return 6 + Math.floor((safeStage - 1) / 4);
    }, []);

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
    // Tower state
    const [towerRun, setTowerRun] = useState<TowerRunState | null>(null);
    const [towerMeta, setTowerMeta] = useState<TowerMeta>(() => getDefaultTowerMeta());
    const [towerActiveEvent, setTowerActiveEvent] = useState<typeof TOWER_EVENTS[number] | null>(null);
    const [towerCardOffer, setTowerCardOffer] = useState<RunCard[] | null>(null);
    const [towerShopItems, setTowerShopItems] = useState<Item[] | null>(null);
    const [towerSanctuaryOptions, setTowerSanctuaryOptions] = useState<TowerSanctuaryOption[]>([]);
    const [towerRunItems, setTowerRunItems] = useState<Item[]>([]);
    const [towerResultOutcome, setTowerResultOutcome] = useState<'victory' | 'defeat' | 'withdrawal'>('defeat');
    const towerRunRef = useRef<TowerRunState | null>(null);
    const postCardFlowRef = useRef<'tavern' | 'boss-victory' | 'resume-hunt' | null>(null);
    const bossVictoryContextRef = useRef<BossVictoryContext | null>(null);
    // Refs for battle timeline effects (always current)
    const enemyRef = useRef<Enemy | null>(null);
    const additionalEnemiesRef = useRef<Enemy[]>([]);
    const playerRef = useRef<Player | null>(null);
    const primaryEnemyIdRef = useRef<string | null>(null);
    const enemySlotAssignmentsRef = useRef<Record<string, number>>({});
    const activeBattleActorIdRef = useRef<string | null>(null);
    enemyRef.current = enemy;
    additionalEnemiesRef.current = additionalEnemies;
    playerRef.current = player;
    primaryEnemyIdRef.current = primaryEnemyId;
    enemySlotAssignmentsRef.current = enemySlotAssignments;
    const [pendingDungeonQueue, setPendingDungeonQueue] = useState<CardRewardOffer[]>([]);
    const [isBootReady, setIsBootReady] = useState(() => getBootReadyMemory());
    const [pathname, setPathname] = useState(() => window.location.pathname);
    const [selectedStartingClassId, setSelectedStartingClassId] = useState<Player['classId']>(INITIAL_PLAYER.classId);
    const [hasConfirmedStartingClass, setHasConfirmedStartingClass] = useState(false);
    const [isSaveSlotCatalogReady, setIsSaveSlotCatalogReady] = useState(false);
    const [saveSlots, setSaveSlots] = useState<SaveSlotSummary[]>([]);
    const [selectedSaveSlotId, setSelectedSaveSlotId] = useState<SaveSlotId>(() => getActiveSaveSlotId());
    const [hasSavePromptDecision, setHasSavePromptDecision] = useState(false);
    const [showClearSaveConfirmModal, setShowClearSaveConfirmModal] = useState(false);
    const [clearSaveModalVisible, setClearSaveModalVisible] = useState(false);
    const [clearHoldProgress, setClearHoldProgress] = useState(0);
    const [showSlotContinueModal, setShowSlotContinueModal] = useState(false);
    const [slotContinueModalVisible, setSlotContinueModalVisible] = useState(false);
    const [slotHoldProgress, setSlotHoldProgress] = useState(0);
    const [pendingContinueSlot, setPendingContinueSlot] = useState<SaveSlotSummary | null>(null);
    const [loadingSplash, setLoadingSplash] = useState<{ slot: SaveSlotSummary; visible: boolean } | null>(null);
    const [resourceUnlockModal, setResourceUnlockModal] = useState<{ name: string; color: string } | null>(null);
    const [levelUpModal, setLevelUpModal] = useState<{ levelsGained: number; nextLevel: number } | null>(null);

    // ── Sincroniza refs do save menu (usados no handler de gamepad sem re-assinar) ──
    useEffect(() => { hasConfirmedClassRef.current = hasConfirmedStartingClass; });
    useEffect(() => {
      const existingSlots = saveSlots.filter(s => s.hasSave);
      const firstEmpty = saveSlots.find(s => !s.hasSave)?.slotId ?? null;
      saveMenuSlotsRef.current = existingSlots;
      canCreateNewSaveRef.current = firstEmpty !== null;
      canDesfazarRef.current = firstEmpty === null && existingSlots.length > 0;
    }, [saveSlots]);
    useEffect(() => { saveMenuFocusRef.current = saveMenuFocusIdx; }, [saveMenuFocusIdx]);
    useEffect(() => { showSlotContinueModalRef.current = showSlotContinueModal; }, [showSlotContinueModal]);
    useEffect(() => { showClearSaveConfirmModalRef.current = showClearSaveConfirmModal; }, [showClearSaveConfirmModal]);

    // ── Hold-to-confirm: rastrea quanto tempo o botão A/✕ é segurado no modal de exclusão ──
    useEffect(() => {
      if (!showClearSaveConfirmModal || menuUiProfile !== 'gamepad') {
        clearHoldProgressRef.current = 0;
        setClearHoldProgress(0);
        return;
      }
      let rafId: number;
      let lastTime: number | null = null;
      const HOLD_MS = 1500;
      function frame(now: number) {
        const gpads = Array.from(navigator.getGamepads());
        const btnDown = gpads.some(g => g && (g.buttons[0]?.pressed || (g.buttons[0]?.value ?? 0) > 0.5));
        if (lastTime === null) lastTime = now;
        const dt = Math.min(now - lastTime, 100);
        lastTime = now;
        if (btnDown) {
          const next = Math.min(100, clearHoldProgressRef.current + (dt / HOLD_MS) * 100);
          clearHoldProgressRef.current = next;
          setClearHoldProgress(next);
          if (next >= 100) {
            clearHoldProgressRef.current = 0;
            setClearHoldProgress(0);
            clearModalConfirmRef.current();
            return;
          }
        } else {
          if (clearHoldProgressRef.current > 0) {
            clearHoldProgressRef.current = 0;
            setClearHoldProgress(0);
            lastTime = null;
          }
        }
        rafId = requestAnimationFrame(frame);
      }
      rafId = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(rafId);
    }, [showClearSaveConfirmModal, menuUiProfile]);

    // ── Hold-to-confirm: modal de continuar slot (Jogar) ──
    useEffect(() => {
      if (!showSlotContinueModal || menuUiProfile !== 'gamepad') {
        slotHoldProgressRef.current = 0;
        setSlotHoldProgress(0);
        return;
      }
      let rafId: number;
      let lastTime: number | null = null;
      const HOLD_MS = 1500;
      function frame(now: number) {
        const gpads = Array.from(navigator.getGamepads());
        const btnDown = gpads.some(g => g && (g.buttons[0]?.pressed || (g.buttons[0]?.value ?? 0) > 0.5));
        if (lastTime === null) lastTime = now;
        const dt = Math.min(now - lastTime, 100);
        lastTime = now;
        if (btnDown) {
          const next = Math.min(100, slotHoldProgressRef.current + (dt / HOLD_MS) * 100);
          slotHoldProgressRef.current = next;
          setSlotHoldProgress(next);
          if (next >= 100) {
            slotHoldProgressRef.current = 0;
            setSlotHoldProgress(0);
            modalConfirmRef.current();
            return;
          }
        } else {
          if (slotHoldProgressRef.current > 0) {
            slotHoldProgressRef.current = 0;
            setSlotHoldProgress(0);
            lastTime = null;
          }
        }
        rafId = requestAnimationFrame(frame);
      }
      rafId = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(rafId);
    }, [showSlotContinueModal, menuUiProfile]);

    const openConstellationToken = 0;
    const bootEnemies = useMemo(() => [...ENEMY_DATA, ...DUNGEON_ENEMY_DATA, DUNGEON_BOSS], []);
    const heroClassDefinition = useMemo(
        () => PLAYER_CLASSES.find((entry) => entry.id === player.classId) ?? PLAYER_CLASSES[0],
        [player.classId],
    );
    const heroClassAccentColor = heroClassDefinition.visualProfile.secondaryColor;
    const heroClassAuraColor = heroClassDefinition.visualProfile.auraColor;
    const handleBootReady = useCallback(() => {
        setBootReadyMemory(true);
        setIsBootReady(true);
    }, []);

    useEffect(() => {
        if (!isBootReady || !hasConfirmedStartingClass || pathname.startsWith('/developer')) {
            return;
        }

        warmupBattleRuntimeAssets({
            playerClasses: PLAYER_CLASSES,
            enemies: bootEnemies,
            activeClassId: player.classId,
        });
    }, [bootEnemies, hasConfirmedStartingClass, isBootReady, pathname, player.classId]);

    const createStartingPlayer = useCallback((classId: Player['classId']) => (
        syncPlayerConstellationSkills({
            ...applyPlayerClass(clonePlayer(INITIAL_PLAYER), classId),
            classId,
            classResource: createClassResourceState(classId),
            statusEffects: [],
        }, SKILLS)
    ), []);

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
    const [playerExecutionAnimationId, setPlayerExecutionAnimationId] = useState<string | null>(null);
    const [enemyExecutionAnimationId, setEnemyExecutionAnimationId] = useState<string | null>(null);
    const [playerExecutionAnimationTintColor, setPlayerExecutionAnimationTintColor] = useState<string | null>(null);
    const [enemyExecutionAnimationTintColor, setEnemyExecutionAnimationTintColor] = useState<string | null>(null);
    const [playerImpactAnimationId, setPlayerImpactAnimationId] = useState<string | null>(null);
    const [enemyImpactAnimationId, setEnemyImpactAnimationId] = useState<string | null>(null);
    const [playerImpactAnimationTintColor, setPlayerImpactAnimationTintColor] = useState<string | null>(null);
    const [enemyImpactAnimationTintColor, setEnemyImpactAnimationTintColor] = useState<string | null>(null);
    const [playerImpactAnimationTarget, setPlayerImpactAnimationTarget] = useState<'self' | 'target'>('target');
    const [enemyImpactAnimationTarget, setEnemyImpactAnimationTarget] = useState<'self' | 'target'>('target');
    const [playerImpactAnimationTrigger, setPlayerImpactAnimationTrigger] = useState(0);
    const [enemyImpactAnimationTrigger, setEnemyImpactAnimationTrigger] = useState(0);
    const [playerBowShotTrigger, setPlayerBowShotTrigger] = useState(0);
    const [enemyBowShotTrigger, setEnemyBowShotTrigger] = useState(0);
    const [playerBowShotDidHit, setPlayerBowShotDidHit] = useState(true);
    const [enemyBowShotDidHit, setEnemyBowShotDidHit] = useState(true);
    const [menuHeroAction, setMenuHeroAction] = useState<PlayerAnimationAction>('idle');
    const [menuCameraFocusOverride, setMenuCameraFocusOverride] = useState<boolean | null>(null);
    const [showTavernUi, setShowTavernUi] = useState(true);
    const [shopReturnToInventory, setShopReturnToInventory] = useState(false);
    const [shopReturnInventoryFilter, setShopReturnInventoryFilter] = useState<'all' | 'equipment' | 'potion' | 'material'>('all');
    const [openInventoryFromShopToken, setOpenInventoryFromShopToken] = useState(0);
    const [openInventoryFromShopFilter, setOpenInventoryFromShopFilter] = useState<'all' | 'equipment' | 'potion' | 'material'>('all');
    const [openProfileFromHeroToken, setOpenProfileFromHeroToken] = useState(0);
    const [openHeroInspectToken, setOpenHeroInspectToken] = useState(0);
    const [heroInspectMode, setHeroInspectMode] = useState(false);
    const [heroInspectCloseToken, setHeroInspectCloseToken] = useState(0);
    const [heroEquipOpenToken, setHeroEquipOpenToken] = useState(0);
    const [heroEquipOpenFilter, setHeroEquipOpenFilter] = useState<'weapon' | 'shield' | 'helmet' | 'armor' | 'legs'>('weapon');
    const [heroSkillSlotOpenToken, setHeroSkillSlotOpenToken] = useState(0);
    const [heroSkillSlotOpenIndex, setHeroSkillSlotOpenIndex] = useState(0);
    const [heroItemSlotOpenToken, setHeroItemSlotOpenToken] = useState(0);
    const [heroItemSlotOpenIndex, setHeroItemSlotOpenIndex] = useState(0);
    const [campGamepadFocusForScene, setCampGamepadFocusForScene] = useState<'hero' | 'portal' | null>(null);
    const huntEnemyBagRef = useRef<EnemyTemplate[]>([]);
    const dungeonEnemyBagRef = useRef<DungeonEnemyTemplate[]>([]);
    const [sceneRegion, setSceneRegion] = useState<SceneRegion>('forest');
    const [openPortalTravelToken, setOpenPortalTravelToken] = useState(0);
    const [portalInspectMode, setPortalInspectMode] = useState(false);
    const [portalTransitioning, setPortalTransitioning] = useState(false);
    const portalTransitionClearTimerRef = useRef<number | null>(null);
    const [menuPortalTravelCinematicToken, setMenuPortalTravelCinematicToken] = useState(0);
    const [portalSceneOverlay, setPortalSceneOverlay] = useState<{ targetRegion: SceneRegion; phase: 'in' | 'hold' | 'out' } | null>(null);
    const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>('intro_camp');
    const [missions, setMissions] = useState<Mission[]>(() => INITIAL_MISSIONS.map(m => ({ ...m })));
  const [missionToast, setMissionToast] = useState<MissionToastItem | null>(null);
  const [openMissionsFromToastToken, setOpenMissionsFromToastToken] = useState(0);
    const [showMissions, setShowMissions] = useState(false);
    const [hasPlayerDiedOnce, setHasPlayerDiedOnce] = useState(false);
    const [skillsUnlockPromptPending, setSkillsUnlockPromptPending] = useState(false);
    const [impulseUnlockPromptQueue, setImpulseUnlockPromptQueue] = useState<number[]>([]);
    const [constellationUnlockPromptPending, setConstellationUnlockPromptPending] = useState(false);
    const [constellationRespecUnlockPromptPending, setConstellationRespecUnlockPromptPending] = useState(false);
    const [constellationRespecPromptSeen, setConstellationRespecPromptSeen] = useState(false);
    const [skillsActionUnlocked, setSkillsActionUnlocked] = useState(false);
    const [hasDiamondHudUnlocked, setHasDiamondHudUnlocked] = useState(false);
    const [diamondUnlockPromptPending, setDiamondUnlockPromptPending] = useState(false);
    const previousSkillCountRef = useRef(player.skills.length);
    const enemyAnimationResetTimerRef = useRef<number | null>(null);
    const menuTransitionTimerRef = useRef<number | null>(null);
    const menuHeroActionResetTimerRef = useRef<number | null>(null);
    const autosaveTimerRef = useRef<number | null>(null);
    const levelUpModalTimerRef = useRef<number | null>(null);
    const portalTravelRegionSwapTimerRef = useRef<number | null>(null);
    const lastSavedSignatureRef = useRef<string>('');
    const persistSaveNowRef = useRef<(override?: Partial<SavePayload>) => boolean>(() => false);
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

    const handleMenuHeroClick = useCallback(() => {
        if (menuHeroActionResetTimerRef.current !== null) {
            window.clearTimeout(menuHeroActionResetTimerRef.current);
            menuHeroActionResetTimerRef.current = null;
        }

        setPortalInspectMode(false);
        setMenuHeroAction('item');
        setOpenHeroInspectToken((prev) => prev + 1);
        menuHeroActionResetTimerRef.current = window.setTimeout(() => {
            menuHeroActionResetTimerRef.current = null;
            setMenuHeroAction('idle');
        }, 720);
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
        dungeonSubBossDefeatedEvolution,
        onboardingPhase,
        hasPlayerDiedOnce,
        skillsActionUnlocked,
        skillsUnlockPromptPending,
        impulseUnlockPromptQueue,
        constellationUnlockPromptPending,
        constellationRespecUnlockPromptPending,
        constellationRespecPromptSeen,
        hasDiamondHudUnlocked,
        gameState,
        turnState,
        hasEnemy: Boolean(enemy),
        hadDungeonRun: Boolean(dungeonRun),
        cardRewardQueue: cloneCardRewardOffers(cardRewardQueue),
        currentCardOffer: currentCardOffer ? { ...currentCardOffer } : null,
        currentCardChoices: cloneProgressionCards(currentCardChoices),
        postCardFlow,
        dungeonRun: cloneDungeonRunState(dungeonRun),
        dungeonResult: cloneDungeonResultState(dungeonResult),
        bossVictoryContext: cloneBossVictoryContextState(bossVictoryContext),
        pendingDungeonQueue: cloneCardRewardOffers(pendingDungeonQueue),
        towerRun: towerRun ? JSON.parse(JSON.stringify(towerRun)) as TowerRunState : null,
        towerMeta: { ...towerMeta },
        missions: missions.map(m => ({ ...m })),
        logs: cloneBattleLogs(logs),
        narration,
        sceneRegion,
        ...stateOverride,
    }), [
        bossVictoryContext,
        cardRewardQueue,
        constellationUnlockPromptPending,
        constellationRespecPromptSeen,
        constellationRespecUnlockPromptPending,
        hasDiamondHudUnlocked,
        currentCardChoices,
        currentCardOffer,
        dungeonEvolution,
        dungeonSubBossDefeatedEvolution,
        dungeonResult,
        dungeonRun,
        enemy,
        gameState,
        hasPlayerDiedOnce,
        killCount,
        logs,
        narration,
        onboardingPhase,
        pendingDungeonQueue,
        player,
        postCardFlow,
        sceneRegion,
        skillsActionUnlocked,
        skillsUnlockPromptPending,
        impulseUnlockPromptQueue,
        stage,
        turnState,
        towerRun,
        towerMeta,
        missions,
    ]);

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
    // Keep ref always pointing to latest version (avoids stale closures in battle)
    persistSaveNowRef.current = persistSaveNow;

    const applyLoadedSave = useCallback((slotId: SaveSlotId) => {
        const loaded = loadSaveFromSlot(slotId);
        if (!loaded) {
            return false;
        }

        const { payload, interruptedBattle, interruptedDungeon } = loaded;
        const normalizedPlayer = normalizeSavedPlayerForCurrentBuild(payload.player);
        const wasInterrupted = interruptedBattle || interruptedDungeon;
        const safePhase = coerceOnboardingPhase(payload.onboardingPhase);
        const restoredTurnState = payload.turnState ?? TurnState.PLAYER_INPUT;
        const restoredSkillsPromptPending = payload.skillsUnlockPromptPending ?? false;
        const restoredImpulseUnlockPromptQueue = Array.isArray(payload.impulseUnlockPromptQueue)
            ? payload.impulseUnlockPromptQueue.filter((level): level is number => IMPULSE_UNLOCK_LEVELS.includes(level as 4 | 8 | 12))
            : [];
        const restoredConstellationPromptPending = payload.constellationUnlockPromptPending ?? false;
        const restoredConstellationRespecPromptPending = payload.constellationRespecUnlockPromptPending ?? false;
        const restoredConstellationRespecPromptSeen = payload.constellationRespecPromptSeen ?? false;
        const restoredDungeonSubBossDefeatedEvolution = payload.dungeonSubBossDefeatedEvolution ?? null;
        const restoredDiamondHudUnlocked = payload.hasDiamondHudUnlocked ?? normalizedPlayer.diamonds > 0;
        const restoredCardRewardQueue = payload.cardRewardQueue ? cloneCardRewardOffers(payload.cardRewardQueue) : [];
        const restoredCurrentCardOffer = payload.currentCardOffer ? { ...payload.currentCardOffer } : null;
        const restoredCurrentCardChoices = payload.currentCardChoices ? cloneProgressionCards(payload.currentCardChoices) : [];
        const restoredPostCardFlow = payload.postCardFlow ?? null;
        const restoredDungeonRun = payload.dungeonRun
            ? (() => {
                const clonedRun = cloneDungeonRunState(payload.dungeonRun);
                if (!clonedRun) {
                    return null;
                }

                return {
                    ...clonedRun,
                    entrySnapshot: normalizeSavedPlayerForCurrentBuild(clonedRun.entrySnapshot),
                };
            })()
            : null;
        const restoredDungeonResult = payload.dungeonResult ? cloneDungeonResultState(payload.dungeonResult) : null;
        const restoredBossVictoryContext = payload.bossVictoryContext ? cloneBossVictoryContextState(payload.bossVictoryContext) : null;
        const restoredPendingDungeonQueue = payload.pendingDungeonQueue ? cloneCardRewardOffers(payload.pendingDungeonQueue) : [];
        const restoredLogs = payload.logs ? cloneBattleLogs(payload.logs) : [];
        const restoredNarration = payload.narration ?? 'Progresso carregado.';

        setActiveSaveSlotId(slotId);
        setSelectedSaveSlotId(slotId);
        setSelectedStartingClassId(normalizedPlayer.classId);
        setHasConfirmedStartingClass(true);

        setPlayer(clonePlayer(normalizedPlayer));
        setStage(payload.stage);
        setKillCount(wasInterrupted ? 0 : payload.killCount);
        setDungeonEvolution(payload.dungeonEvolution);
        setDungeonSubBossDefeatedEvolution(restoredDungeonSubBossDefeatedEvolution);
        setOnboardingPhase(safePhase);
        setHasPlayerDiedOnce(payload.hasPlayerDiedOnce || wasInterrupted);
        setSkillsActionUnlocked(payload.skillsActionUnlocked);
        setSkillsUnlockPromptPending(wasInterrupted ? false : restoredSkillsPromptPending);
        setImpulseUnlockPromptQueue(wasInterrupted ? [] : restoredImpulseUnlockPromptQueue);
        setConstellationUnlockPromptPending(wasInterrupted ? false : restoredConstellationPromptPending);
        setConstellationRespecUnlockPromptPending(wasInterrupted ? false : restoredConstellationRespecPromptPending);
        setConstellationRespecPromptSeen(restoredConstellationRespecPromptSeen);
        setHasDiamondHudUnlocked(restoredDiamondHudUnlocked);
        setDiamondUnlockPromptPending(false);
        previousSkillCountRef.current = normalizedPlayer.skills.length;

        setEnemy(null);
        setLogs(wasInterrupted
            ? [{ message: interruptedDungeon ? 'Run da dungeon encerrada por fechamento inesperado. Voce voltou ao acampamento e perdeu o espolio pendente.' : 'Batalha interrompida por fechamento inesperado. Derrota aplicada e retorno ao acampamento.', type: 'info' }]
            : restoredLogs);
        setNarration(wasInterrupted
            ? interruptedDungeon
                ? 'Voce retornou ao acampamento apos interrupcao da dungeon.'
                : 'Voce retornou ao acampamento apos interrupcao de batalha.'
            : restoredNarration);
        setPostCardFlow(wasInterrupted ? null : restoredPostCardFlow);
        setDungeonRun(wasInterrupted ? null : restoredDungeonRun);
        setDungeonResult(wasInterrupted ? null : restoredDungeonResult);
        setBossVictoryContext(wasInterrupted ? null : restoredBossVictoryContext);
        setPendingDungeonQueue(wasInterrupted ? [] : restoredPendingDungeonQueue);
        setTowerRun(wasInterrupted ? null : (payload.towerRun ?? null));
        setTowerMeta(payload.towerMeta ?? getDefaultTowerMeta());
        if (payload.missions && payload.missions.length > 0) {
            // Migrate descriptions: sync saved missions with current INITIAL_MISSIONS text
            const descById = Object.fromEntries(INITIAL_MISSIONS.map(m => [m.id, m.descricao]));
            setMissions(payload.missions.map(m => ({
                ...m,
                descricao: descById[m.id] ?? m.descricao,
            })));
        }
        setCardRewardQueue(wasInterrupted ? [] : restoredCardRewardQueue);
        setCurrentCardOffer(wasInterrupted ? null : restoredCurrentCardOffer);
        setCurrentCardChoices(wasInterrupted ? [] : restoredCurrentCardChoices);
        setTurnState(wasInterrupted ? TurnState.PLAYER_INPUT : restoredTurnState);
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
                || payload.gameState === GameState.CARD_REWARD
                || payload.gameState === GameState.BOSS_VICTORY
                || payload.gameState === GameState.DUNGEON_RESULT
                || payload.gameState === GameState.TOWER_HUB
                || payload.gameState === GameState.TOWER_MAP
                || payload.gameState === GameState.TOWER_SANCTUARY
                || payload.gameState === GameState.TOWER_RESULT
                ? payload.gameState
                : GameState.TAVERN;
            setGameState(resumableState);
            setSceneRegion(payload.sceneRegion);
        }

        const signaturePayload: SavePayload = {
            ...payload,
            player: normalizedPlayer,
            onboardingPhase: safePhase,
            hasPlayerDiedOnce: payload.hasPlayerDiedOnce || wasInterrupted,
            dungeonSubBossDefeatedEvolution: restoredDungeonSubBossDefeatedEvolution,
            skillsUnlockPromptPending: wasInterrupted ? false : restoredSkillsPromptPending,
            impulseUnlockPromptQueue: wasInterrupted ? [] : restoredImpulseUnlockPromptQueue,
            constellationUnlockPromptPending: wasInterrupted ? false : restoredConstellationPromptPending,
            constellationRespecUnlockPromptPending: wasInterrupted ? false : restoredConstellationRespecPromptPending,
            constellationRespecPromptSeen: restoredConstellationRespecPromptSeen,
            hasDiamondHudUnlocked: restoredDiamondHudUnlocked,
            turnState: wasInterrupted ? TurnState.PLAYER_INPUT : restoredTurnState,
            cardRewardQueue: wasInterrupted ? [] : restoredCardRewardQueue,
            currentCardOffer: wasInterrupted ? null : restoredCurrentCardOffer,
            currentCardChoices: wasInterrupted ? [] : restoredCurrentCardChoices,
            postCardFlow: wasInterrupted ? null : restoredPostCardFlow,
            dungeonRun: wasInterrupted ? null : restoredDungeonRun,
            dungeonResult: wasInterrupted ? null : restoredDungeonResult,
            bossVictoryContext: wasInterrupted ? null : restoredBossVictoryContext,
            pendingDungeonQueue: wasInterrupted ? [] : restoredPendingDungeonQueue,
            logs: wasInterrupted
                ? [{ message: interruptedDungeon ? 'Run da dungeon encerrada por fechamento inesperado. Voce voltou ao acampamento e perdeu o espolio pendente.' : 'Batalha interrompida por fechamento inesperado. Derrota aplicada e retorno ao acampamento.', type: 'info' }]
                : restoredLogs,
            narration: wasInterrupted
                ? (interruptedDungeon
                    ? 'Voce retornou ao acampamento apos interrupcao da dungeon.'
                    : 'Voce retornou ao acampamento apos interrupcao de batalha.')
                : restoredNarration,
            gameState: wasInterrupted ? GameState.TAVERN : payload.gameState,
            hasEnemy: false,
            hadDungeonRun: false,
            sceneRegion: wasInterrupted ? 'forest' : payload.sceneRegion,
            killCount: wasInterrupted ? 0 : payload.killCount,
        };
        lastSavedSignatureRef.current = JSON.stringify(signaturePayload);

        return true;
    }, []);

    useEffect(() => () => {
        if (enemyAnimationResetTimerRef.current !== null) {
            window.clearTimeout(enemyAnimationResetTimerRef.current);
        }
        if (menuTransitionTimerRef.current !== null) {
            window.clearTimeout(menuTransitionTimerRef.current);
        }
        if (menuHeroActionResetTimerRef.current !== null) {
            window.clearTimeout(menuHeroActionResetTimerRef.current);
        }
        if (autosaveTimerRef.current !== null) {
            window.clearTimeout(autosaveTimerRef.current);
        }
        if (levelUpModalTimerRef.current !== null) {
            window.clearTimeout(levelUpModalTimerRef.current);
        }
        if (portalTravelRegionSwapTimerRef.current !== null) {
            window.clearTimeout(portalTravelRegionSwapTimerRef.current);
        }
    }, []);

    useEffect(() => {
        if (!isBootReady || hasConfirmedStartingClass) {
            return;
        }

        refreshSaveSlotCatalog();
        setSelectedSaveSlotId(getActiveSaveSlotId());
        setHasSavePromptDecision(false);
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
        dungeonSubBossDefeatedEvolution,
        dungeonEvolution,
        dungeonResult,
        dungeonRun,
        enemy,
        gameState,
        hasConfirmedStartingClass,
        hasPlayerDiedOnce,
        killCount,
        bossVictoryContext,
        cardRewardQueue,
        constellationUnlockPromptPending,
        constellationRespecUnlockPromptPending,
        constellationRespecPromptSeen,
        hasDiamondHudUnlocked,
        currentCardChoices,
        currentCardOffer,
        logs,
        narration,
        onboardingPhase,
        missions,
        pendingDungeonQueue,
        persistSaveNow,
        player,
        postCardFlow,
        sceneRegion,
        skillsActionUnlocked,
        skillsUnlockPromptPending,
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
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        const flushLifecycleSave = () => {
            if (!hasConfirmedStartingClass) {
                return;
            }

            persistSaveNow();
        };

        const flushWhenHidden = () => {
            if (document.visibilityState === 'hidden') {
                flushLifecycleSave();
            }
        };

        window.addEventListener('beforeunload', flushLifecycleSave);
        window.addEventListener('pagehide', flushLifecycleSave);
        document.addEventListener('visibilitychange', flushWhenHidden);

        return () => {
            window.removeEventListener('beforeunload', flushLifecycleSave);
            window.removeEventListener('pagehide', flushLifecycleSave);
            document.removeEventListener('visibilitychange', flushWhenHidden);
        };
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

    useEffect(() => {
        towerRunRef.current = towerRun;
    }, [towerRun]);

  // --- VFX SYSTEM ---
  const spawnParticles = (position: [number, number, number], count: number, color: string, type: 'explode' | 'heal' | 'spark') => {
      const densityMultiplier = type === 'explode' ? 0.72 : type === 'spark' ? 0.68 : 0.78;
      const targetCount = Math.max(6, Math.round(count * densityMultiplier));
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const nowMs = Date.now();
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
              expiresAt: nowMs + 1100,
              renderMode: isShard ? 'shard3d' : 'sprite2d',
              velocity: [
                  (Math.random() - 0.5) * spread * 2,
                  (Math.random() - 0.5) * 1.7 + lift,
                  (Math.random() - 0.5) * spread * 2,
              ],
          });
      }

      setParticles((prev) => [...prev, ...newParticles].slice(-120));
  };

  const spawnFloatingText = (
      value: string | number,
      target: 'player' | 'enemy',
      type: 'damage' | 'heal' | 'crit' | 'buff' | 'skill' | 'item',
      color?: string,
      iconImage?: string,
  ) => {
      const id = Math.random().toString(36);
            const nowMs = Date.now();
      const isNamedActionText = type === 'skill' || type === 'item';
      const durationMs = type === 'item'
        ? 1200
        : isNamedActionText
          ? 2100
          : type === 'crit'
            ? 1500
            : 1100;
      setFloatingTexts(prev => [...prev, {
          id,
          text: value.toString(),
          iconImage,
          type,
          target,
          xOffset: isNamedActionText ? 0 : (Math.random() * 40) - 20, // Keep skill/item labels centered and readable
          yOffset: isNamedActionText ? 0 : (Math.random() * 20) - 10,
          durationMs,
          expiresAt: nowMs + durationMs,
          color,
      }].slice(-8));
  };

  useEffect(() => {
      if (particles.length === 0 && floatingTexts.length === 0) {
          return;
      }

      const pruneExpiredVfx = () => {
          const nowMs = Date.now();

          setParticles((prev) => {
              const next = prev.filter((particle) => !particle.expiresAt || particle.expiresAt > nowMs);
              return next.length === prev.length ? prev : next;
          });

          setFloatingTexts((prev) => {
              const next = prev.filter((text) => !text.expiresAt || text.expiresAt > nowMs);
              return next.length === prev.length ? prev : next;
          });
      };

      pruneExpiredVfx();
      const timer = window.setInterval(pruneExpiredVfx, 180);

      return () => {
          window.clearInterval(timer);
      };
  }, [floatingTexts.length, particles.length]);

    useEffect(() => {
        const handleLocationChange = () => setPathname(window.location.pathname);
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const hasUnlockedSkill = (currentPlayer: Player, skillId?: string) => {
        if (!skillId) {
            return false;
        }

        return currentPlayer.skills.some(skill => skill.id === skillId);
    };

    const isCardEligibleForOffer = (card: ProgressionCard, source: CardRewardOffer['source'], currentPlayer: Player, phaseLevel: number) => {
        if (!card.offerSources.includes(source) || card.minLevel > phaseLevel) {
            return false;
        }

        const unlockEffects = card.effects.filter(effect => effect.type === 'unlock_skill');
        if (unlockEffects.length === 0) {
            return true;
        }

        return unlockEffects.some(effect => !hasUnlockedSkill(currentPlayer, effect.skillId))
            || card.effects.some(effect => effect.type !== 'unlock_skill');
    };

    const generateCardChoices = (source: CardRewardOffer['source'], currentPlayer: Player, phaseLevel: number) => {
        const availablePool = PROGRESSION_CARDS.filter(card => isCardEligibleForOffer(card, source, currentPlayer, phaseLevel));

        const fallbackPool = PROGRESSION_CARDS.filter(card => (
            card.offerSources.includes(source)
            && card.minLevel <= phaseLevel
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
            nextPlayer.xpToNext = getXpToNextByLevel(nextPlayer.level);
        }

        if (levelsGained > 0) {
            nextPlayer.talentPoints += levelsGained;
        }

        const newlyUnlockedImpulseLevels = levelsGained > 0
            ? IMPULSE_UNLOCK_LEVELS.filter((unlockLevel) => basePlayer.level < unlockLevel && nextPlayer.level >= unlockLevel)
            : [];

        if (newlyUnlockedImpulseLevels.length > 0) {
            setImpulseUnlockPromptQueue((prev) => {
                const merged = [...prev];
                newlyUnlockedImpulseLevels.forEach((unlockLevel) => {
                    if (!merged.includes(unlockLevel)) {
                        merged.push(unlockLevel);
                    }
                });
                return merged;
            });
        }

        const maxImpulse = getImpulseCapacityByLevel(nextPlayer.level);
        nextPlayer.impulso = Math.max(0, Math.min(maxImpulse, nextPlayer.impulso ?? 0));
        nextPlayer.impulsoAtivo = Math.max(0, Math.min(maxImpulse, nextPlayer.impulsoAtivo ?? 0));

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

    const showLevelUpModal = useCallback((levelsGained: number, nextLevel: number) => {
        if (levelsGained <= 0) {
            return;
        }

        if (levelUpModalTimerRef.current !== null) {
            window.clearTimeout(levelUpModalTimerRef.current);
            levelUpModalTimerRef.current = null;
        }

        setLevelUpModal({ levelsGained, nextLevel });
        levelUpModalTimerRef.current = window.setTimeout(() => {
            levelUpModalTimerRef.current = null;
            setLevelUpModal(null);
        }, 2600);
    }, []);

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
        if (skill.id === 'skl_11') return { color: '#60a5fa', particleCount: 20, shake: 0.18, castDelay: 520 };
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
            const unlockedBefore = prev.unlockedTalentNodeIds.length;
            const result = unlockTalentNode(prev, nodeId, SKILLS);
            if (!result) {
                return prev;
            }

            addLog(`Constelacao: ${result.node.title} ativada.`, 'buff');
            if (hasUnlockedMusic) {
                uiSfx.play('evolution_point');
            }
            const unlockedAfter = result.player.unlockedTalentNodeIds.length;
            if (!constellationRespecPromptSeen && unlockedBefore < 2 && unlockedAfter >= 2) {
                setConstellationRespecPromptSeen(true);
                setConstellationRespecUnlockPromptPending(true);
            }
            return result.player;
        });
    };

    const handleResetTalents = () => {
        setPlayer((prev) => {
            const nextPlayer = resetTalentNodes(prev, SKILLS);
            if (nextPlayer === prev) {
                return prev;
            }
            addLog('Pontos de constelacao redistribuidos.', 'info');
            if (hasUnlockedMusic) {
                uiSfx.play('evolution_point_redistribute');
            }
            return nextPlayer;
        });
    };

    const PERCENT_CARD_EFFECT_TYPES = new Set([
        'gold_gain_multiplier',
        'xp_gain_multiplier',
        'boss_damage_multiplier',
        'heal_multiplier',
        'opening_atk_buff',
        'opening_def_buff',
        'defend_mana_restore',
    ]);

    const CARD_PERCENT_BY_RARITY: Record<ProgressionCard['rarity'], number> = {
        bronze: 0.04,
        silver: 0.05,
        gold: 0.07,
    };

    const OPENING_COMBAT_BOOST_BY_RARITY: Record<ProgressionCard['rarity'], number> = {
        bronze: 0.1,
        silver: 0.15,
        gold: 0.2,
    };

    const getScaledCardEffectValue = (card: ProgressionCard, effectType: ProgressionCard['effects'][number]['type'], rawValue: number) => {
        if (effectType === 'opening_atk_buff' || effectType === 'opening_def_buff') {
            return OPENING_COMBAT_BOOST_BY_RARITY[card.rarity];
        }
        return PERCENT_CARD_EFFECT_TYPES.has(effectType) ? CARD_PERCENT_BY_RARITY[card.rarity] : rawValue;
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
            const effectValue = getScaledCardEffectValue(card, effect.type, effect.value);
            switch (effect.type) {
                case 'gold_instant':
                    nextPlayer.gold += Math.floor(effectValue);
                    break;
                case 'xp_instant':
                    nextPlayer.xp += Math.floor(effectValue);
                    break;
                case 'max_hp':
                    nextPlayer.stats.maxHp += Math.floor(effectValue);
                    nextPlayer.stats.hp = Math.min(nextPlayer.stats.maxHp, nextPlayer.stats.hp + Math.floor(effectValue));
                    break;
                case 'max_mp':
                    nextPlayer.stats.maxMp += Math.floor(effectValue);
                    nextPlayer.stats.mp = Math.min(nextPlayer.stats.maxMp, nextPlayer.stats.mp + Math.floor(effectValue));
                    break;
                case 'atk':
                    nextPlayer.stats.atk += Math.floor(effectValue);
                    break;
                case 'magic':
                    nextPlayer.stats.magic += Math.floor(effectValue);
                    break;
                case 'def':
                    nextPlayer.stats.def += Math.floor(effectValue);
                    break;
                case 'speed':
                    nextPlayer.stats.speed += Math.floor(effectValue);
                    break;
                case 'luck':
                    nextPlayer.stats.luck += Math.floor(effectValue);
                    break;
                case 'gold_gain_multiplier':
                    nextPlayer.cardBonuses.goldGainMultiplier = Math.min(0.6, nextPlayer.cardBonuses.goldGainMultiplier + effectValue);
                    break;
                case 'xp_gain_multiplier':
                    nextPlayer.cardBonuses.xpGainMultiplier = Math.min(0.6, nextPlayer.cardBonuses.xpGainMultiplier + effectValue);
                    break;
                case 'boss_damage_multiplier':
                    nextPlayer.cardBonuses.bossDamageMultiplier = Math.min(0.35, nextPlayer.cardBonuses.bossDamageMultiplier + effectValue);
                    break;
                case 'heal_multiplier':
                    nextPlayer.cardBonuses.healingMultiplier = Math.min(0.35, nextPlayer.cardBonuses.healingMultiplier + effectValue);
                    break;
                case 'opening_atk_buff':
                    nextPlayer.cardBonuses.openingAtkBuff = Math.min(0.35, nextPlayer.cardBonuses.openingAtkBuff + effectValue);
                    break;
                case 'opening_def_buff':
                    nextPlayer.cardBonuses.openingDefBuff = Math.min(0.35, nextPlayer.cardBonuses.openingDefBuff + effectValue);
                    break;
                case 'defend_mana_restore':
                    nextPlayer.cardBonuses.defendManaRestore = Math.min(0.18, nextPlayer.cardBonuses.defendManaRestore + effectValue);
                    break;
                case 'counter_attack_chance_bonus':
                    nextPlayer.cardBonuses.counterAttackChanceBonus = Math.min(0.25, (nextPlayer.cardBonuses.counterAttackChanceBonus ?? 0) + effectValue);
                    break;
                case 'opening_counter_attack_boost':
                    nextPlayer.cardBonuses.openingCounterAttackBoost = Math.min(0.3, (nextPlayer.cardBonuses.openingCounterAttackBoost ?? 0) + effectValue);
                    break;
                case 'hp_regen_per_turn':
                    nextPlayer.cardBonuses.hpRegenPerTurn = Math.min(60, nextPlayer.cardBonuses.hpRegenPerTurn + Math.floor(effectValue));
                    break;
                case 'mp_regen_per_turn':
                    nextPlayer.cardBonuses.mpRegenPerTurn = Math.min(40, nextPlayer.cardBonuses.mpRegenPerTurn + Math.floor(effectValue));
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
        const offerPhaseLevel = Math.max(1, nextOffer.phaseLevel ?? currentPlayer.level);
        setCurrentCardChoices(generateCardChoices(nextOffer.source, currentPlayer, offerPhaseLevel));
        setCardRewardQueue(remainingOffers);
        uiSfx.play('open_cards_evolution');
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

    const battleTimelineActors = useMemo<BattleTimelineActor[]>(() => {
        const enemiesInBattle = [enemy, ...additionalEnemies].filter((entry): entry is Enemy => Boolean(entry));
        return [
            {
                id: 'player',
                kind: 'player',
                label: player.name,
                classId: player.classId,
                speed: player.stats.speed,
                hp: player.stats.hp,
                priority: 0,
            },
            ...enemiesInBattle.map((entry, index) => ({
                id: entry.id,
                kind: 'enemy' as const,
                label: entry.name,
                classId: entry.enemyClassId ?? 'knight',
                speed: entry.stats.speed,
                hp: entry.stats.hp,
                priority: 1 + (enemySlotAssignments[entry.id] ?? index),
            })),
        ];
    }, [additionalEnemies, enemy, enemySlotAssignments, player.classId, player.name, player.stats.hp, player.stats.speed]);

    const isBattleTimelineOverlayPaused = gameState === GameState.BATTLE
        && (showHeroDetailModal || isBattleSettingsModalOpen);
    const effectiveBattleTimelineState: BattleTimelineState = isBattleTimelineOverlayPaused
        ? 'EXECUTING'
        : battleTimelineState;

    const handleBattleActorReady = useCallback((actorId: string) => {
        if (gameState !== GameState.BATTLE) return;

        const currentEnemy = enemyRef.current;
        const currentAdditionals = additionalEnemiesRef.current;
        const currentPlayer = playerRef.current;
        if (!currentEnemy || !currentPlayer || currentPlayer.stats.hp <= 0) return;

        activeBattleActorIdRef.current = actorId;
        setActiveBattleActorId(actorId);

        if (actorId === 'player') {
            setPlayer((prev) => ({
                ...prev,
                isDefending: false,
                isDefendendo: false,
                tipoDefesaAtiva: null,
                buffs: consumeTurnBuffs(prev.buffs),
            }));
            const primaryId = primaryEnemyIdRef.current;
            if (primaryId && currentEnemy.id !== primaryId) {
                const allEnemies = [currentEnemy, ...currentAdditionals].filter(Boolean) as Enemy[];
                const primary = allEnemies.find((entry) => entry.id === primaryId);
                if (primary) {
                    setEnemy(primary);
                    setAdditionalEnemies(allEnemies.filter((entry) => entry.id !== primaryId));
                    setMainEnemySlotIndex(enemySlotAssignmentsRef.current[primaryId] ?? 0);
                }
            }
            setBattleTimelineState('WAITING_INPUT');
            setTurnState(TurnState.PLAYER_INPUT);
            return;
        }

        const allEnemies = [currentEnemy, ...currentAdditionals].filter(Boolean) as Enemy[];
        const nextEnemy = allEnemies.find((entry) => entry.id === actorId);
        if (!nextEnemy || nextEnemy.stats.hp <= 0) {
            activeBattleActorIdRef.current = null;
            setActiveBattleActorId(null);
            setBattleTimelineState('RUNNING');
            setTurnState(TurnState.PROCESSING);
            return;
        }

        if (nextEnemy.id !== currentEnemy.id) {
            setAdditionalEnemies([
                currentEnemy,
                ...currentAdditionals.filter((entry) => entry.id !== actorId),
            ]);
            setEnemy(nextEnemy);
        }
        setMainEnemySlotIndex(enemySlotAssignmentsRef.current[actorId] ?? 0);
        setBattleTimelineState('EXECUTING');
        setTurnState(TurnState.ENEMY_TURN);
    }, [gameState, setEnemy]);

    const {
        gauges: battleActorGauges,
        resetActorGauge,
        removeActorGauge,
        clearGauges,
    } = useBattleTimeline({
        isActive: gameState === GameState.BATTLE && Boolean(enemy) && player.stats.hp > 0,
        actors: battleTimelineActors,
        timelineState: effectiveBattleTimelineState,
        activeActorId: activeBattleActorId,
        onActorReady: handleBattleActorReady,
    });

    /** Chamado quando o ator atual termina a ação; reseta sua barra ATB e retoma o tempo global. */
    const onActorTurnDone = useCallback((actorIdOverride?: string) => {
        const actorId = actorIdOverride ?? activeBattleActorIdRef.current;
        if (actorId) {
            resetActorGauge(actorId);
        }
        activeBattleActorIdRef.current = null;
        setActiveBattleActorId(null);
        setBattleTimelineState('RUNNING');
        setTurnState(TurnState.PROCESSING);
    }, [resetActorGauge]);

  /** Chamado quando um inimigo do grupo morre mas outros ainda estão vivos. */
  const onPartialGroupKill = useCallback((deadEnemyId: string, xpGain: number, goldGain: number) => {
    setAccumulatedGroupRewards(prev => ({ gold: prev.gold + goldGain, xp: prev.xp + xpGain }));
    // Animação visual: XP e ouro flutuando sobre o inimigo morto
    spawnFloatingText(`+${xpGain} XP`, 'enemy', 'buff', '#d97706');
    spawnFloatingText(`+${goldGain}`, 'enemy', 'buff', '#fbbf24');
    removeActorGauge(deadEnemyId);

    const currentPrimary = enemyRef.current;
    const currentAdds = additionalEnemiesRef.current;
    const isPrimaryDead = currentPrimary?.id === deadEnemyId;

    if (isPrimaryDead) {
      // Primário morreu → promove primeiro sobrevivente como novo "enemy" state
      // mas PRESERVA o slot visual de cada um (via enemySlotAssignmentsRef)
      const survivors = currentAdds.filter(e => e.stats.hp > 0);
      const [nextEnemy, ...rest] = survivors;
      if (nextEnemy) {
        setEnemy(nextEnemy);
        setAdditionalEnemies(rest);
        setMainEnemySlotIndex(enemySlotAssignmentsRef.current[nextEnemy.id] ?? 0);
        if (primaryEnemyIdRef.current === deadEnemyId) setPrimaryEnemyId(nextEnemy.id);
      } else {
        setEnemy(null);
        setAdditionalEnemies([]);
        setMainEnemySlotIndex(0);
      }
    } else {
      // Um extra morreu → remove apenas da lista, inimigo principal permanece no lugar
      setAdditionalEnemies(currentAdds.filter(e => e.id !== deadEnemyId));
    }
    }, [removeActorGauge, setEnemy, spawnFloatingText]);

    useEffect(() => {
        if (gameState === GameState.BATTLE) return;
        clearGauges();
        activeBattleActorIdRef.current = null;
        setActiveBattleActorId(null);
        setBattleTimelineState('RUNNING');
    }, [clearGauges, gameState]);

  const addLog = useCallback((message: string, type: BattleLog['type'] = 'info') => {
    setLogs(prev => [{ message, type }, ...prev]);
  }, []);

    const spawnEnemy = async (currentStage: number, isBoss: boolean, mode: 'hunt' | 'dungeon' = dungeonRun ? 'dungeon' : 'hunt', dungeonEvolutionOverride?: number) => {
    // Scale stats based on stage
    let levelMult = getStagePowerMultiplier(currentStage);
    const isDungeonEncounter = mode === 'dungeon';
    const activeDungeonEvolution = dungeonEvolutionOverride ?? dungeonRun?.evolution ?? dungeonEvolution;
    if (isDungeonEncounter) {
    levelMult *= getDungeonPowerMultiplier(activeDungeonEvolution);
    }
    const dungeonClearedInCurrentPhase = dungeonRun?.rewards.clearedMonsters ?? 0;
    const isDungeonSubBossEncounter = isDungeonEncounter
        && !isBoss
        && !dungeonRun?.rewards.subBossDefeatedInPhase
        && (dungeonClearedInCurrentPhase + 1 === 5);
    const isSubBossEncounter = isDungeonSubBossEncounter;
    if (isSubBossEncounter) {
        levelMult *= 1.18;
    }
    if (isBoss) levelMult *= (isDungeonEncounter ? 2.1 : 1.9); // Boss scaling tuned by mode

    const availableDungeonEnemies = DUNGEON_ENEMY_DATA.filter(template => template.minEvolution <= activeDungeonEvolution);
    const dungeonEnemyPool = availableDungeonEnemies.length > 0 ? availableDungeonEnemies : DUNGEON_ENEMY_DATA;

    // Regular hunt mobs use GLTF monsters; sub-boss and boss use class-based skeletons.
    const isRegularHuntMob = !isBoss && !isSubBossEncounter && !isDungeonEncounter;
    const isRegularDungeonMob = !isBoss && !isSubBossEncounter && isDungeonEncounter;

    // Pick a GLTF monster for regular hunt/dungeon mobs
    let gltfMonsterTemplate: typeof GLTF_MONSTER_BESTIARY[number] | null = null;
    if (isRegularHuntMob || isRegularDungeonMob) {
        const pool = getGltfMonsterPoolForStage(currentStage);
        gltfMonsterTemplate = pool[Math.floor(Math.random() * pool.length)] ?? null;
    }

    const enemyTemplate: EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate = isBoss
        ? (isDungeonEncounter ? DUNGEON_BOSS : pickFromEnemyBag(ENEMY_DATA, huntEnemyBagRef))
        : (isDungeonEncounter ? pickFromEnemyBag(dungeonEnemyPool, dungeonEnemyBagRef) : pickFromEnemyBag(ENEMY_DATA, huntEnemyBagRef));
    const enemyClassId = pickEnemyClassId(enemyTemplate);

    // Use GLTF base stats for mob encounters, fallback to template base stats otherwise
    const templateBaseStats = gltfMonsterTemplate ? gltfMonsterTemplate.baseStats : enemyTemplate.baseStats;
    const templateHp = templateBaseStats?.maxHp ?? templateBaseStats?.hp ?? 0;
    const baseHp = Math.max(getEnemyClassBaseHp(enemyClassId), templateHp);
    const templateMp = templateBaseStats?.maxMp ?? templateBaseStats?.mp ?? 0;
    const baseMp = Math.max(getEnemyClassBaseMp(enemyClassId), templateMp);
    const templateAtk = templateBaseStats?.atk ?? 0;
    const templateMagic = (templateBaseStats as any)?.magic ?? 0;
    const templateDef = templateBaseStats?.def ?? 0;
    const baseDef = Math.max(getEnemyClassBaseDef(enemyClassId), templateDef);
    const inferredMagicDef = Math.max(1, Math.floor(baseDef * 0.7));
    const templateMagicDef = templateBaseStats?.magicDef ?? 0;
    const baseAtk = Math.max(getEnemyClassBaseAtkFloor(enemyClassId), templateAtk);
    const baseMagic = Math.max(getEnemyClassBaseMagicFloor(enemyClassId), templateMagic);
    const baseMagicDef = Math.max(
        getEnemyClassBaseMagicDefFloor(enemyClassId),
        templateMagicDef > 0 ? templateMagicDef : inferredMagicDef,
    );
    const templateSpeed = templateBaseStats?.speed ?? 0;
    const baseSpeed = Math.max(getEnemyClassBaseSpeedFloor(enemyClassId), templateSpeed);
    const templateLuck = templateBaseStats?.luck ?? 0;
    const baseLuck = Math.max(getEnemyClassBaseLuck(enemyClassId), templateLuck);
    const templateCombatProfile = enemyTemplate as Partial<DungeonEnemyTemplate & DungeonBossTemplate>;
    const hpMultiplier = templateCombatProfile.hpMultiplier ?? 1;
    const atkMultiplier = templateCombatProfile.atkMultiplier ?? 1;
    const defMultiplier = templateCombatProfile.defMultiplier ?? 1;
    const speedBonus = templateCombatProfile.speedBonus ?? 0;
    const combatProfile = createEnemyCombatProfile(enemyClassId, currentStage, isBoss, isDungeonEncounter, activeDungeonEvolution);
    const classAtkMultiplier: Record<Player['classId'], number> = {
        knight: 1.12,
        barbarian: 1.24,
        mage: 1.06,
        ranger: 1.1,
        rogue: 1.16,
    };
    const classMagicMultiplier: Record<Player['classId'], number> = {
        knight: 0.9,
        barbarian: 0.8,
        mage: 1.36,
        ranger: 1.02,
        rogue: 0.94,
    };
    const tierAtkPressure = Math.min(0.22, combatProfile.tier * 0.025);
    const tierMagicPressure = Math.min(0.28, combatProfile.tier * 0.03);
    const enemyAtkMultiplier = classAtkMultiplier[enemyClassId] * (1 + tierAtkPressure);
    const enemyMagicMultiplier = classMagicMultiplier[enemyClassId] * (1 + tierMagicPressure);
    const hasStrongCycleBoost = combatProfile.tier >= 2;
    const color = isBoss && isDungeonEncounter
        ? DUNGEON_BOSS.color
        : ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
    const encounterRewardMultiplier = isBoss
        ? (isDungeonEncounter ? 3.6 : 3)
        : (isSubBossEncounter ? 1.5 : 1);
    const xpReward = Math.floor(40 * levelMult * encounterRewardMultiplier);
    const stageGoldBonusMultiplier = 1 + (Math.max(1, currentStage) - 1) * 0.045;
    const encounterGoldMultiplier = isBoss
        ? (isDungeonEncounter ? 3.2 : 3)
        : (isSubBossEncounter ? 1.45 : 1);
    const goldReward = Math.floor(25 * levelMult * stageGoldBonusMultiplier * encounterGoldMultiplier);
    
        const name = isBoss
                ? (isDungeonEncounter ? DUNGEON_BOSS.name : `General ${enemyTemplate.name}`)
                : (isSubBossEncounter ? `Subchefe ${enemyTemplate.name}` : (gltfMonsterTemplate ? gltfMonsterTemplate.name : enemyTemplate.name));

    const newEnemy: Enemy = {
      id: `enemy_${Date.now()}`,
      name: name,
      level: currentStage,
      stats: {
            hp: Math.floor(baseHp * levelMult * hpMultiplier * (isSubBossEncounter ? 1.35 : 1)),
            maxHp: Math.floor(baseHp * levelMult * hpMultiplier * (isSubBossEncounter ? 1.35 : 1)),
        mp: baseMp ?? combatProfile.maxMp,
        maxMp: baseMp ?? combatProfile.maxMp,
            atk: Math.floor(baseAtk * levelMult * atkMultiplier * enemyAtkMultiplier * (isSubBossEncounter ? 1.22 : 1)),
                    magic: Math.max(1, Math.floor(baseMagic * levelMult * enemyMagicMultiplier * (isSubBossEncounter ? 1.18 : 1))),
            def: Math.floor(baseDef * levelMult * defMultiplier * (isSubBossEncounter ? 1.2 : 1)),
            magicDef: Math.max(1, Math.floor(baseMagicDef * levelMult * defMultiplier * (isSubBossEncounter ? 1.2 : 1))),
            speed: baseSpeed + speedBonus + (isDungeonEncounter ? Math.floor(activeDungeonEvolution / 3) : 0) + (isSubBossEncounter ? 2 : 0),
        luck: baseLuck !== undefined
            ? Math.max(1, Math.floor(baseLuck + (isBoss ? 3 : 0) + (isSubBossEncounter ? 3 : 0) + (isDungeonEncounter ? activeDungeonEvolution * 0.35 : 0)))
            : Math.max(1, Math.floor((currentStage * 0.55) + (isBoss ? 3 : 0) + (isSubBossEncounter ? 3 : 0) + (isDungeonEncounter ? activeDungeonEvolution * 0.35 : 0)))
      },
            xpReward,
            goldReward,
                        color: isBoss ? (isDungeonEncounter ? DUNGEON_BOSS.color : '#ef4444') : (isSubBossEncounter ? '#d97706' : (gltfMonsterTemplate ? gltfMonsterTemplate.color : (enemyTemplate.color ?? color))),
                        scale: isBoss ? (isDungeonEncounter ? DUNGEON_BOSS.scale : (0.8 + (Math.random() * 0.4)) * 1.3) : ((gltfMonsterTemplate ? gltfMonsterTemplate.scale : (enemyTemplate.scale ?? (0.8 + (Math.random() * 0.4)))) * (isSubBossEncounter ? 1.0 : 1)),
      type: gltfMonsterTemplate ? 'beast' : enemyTemplate.type as 'beast' | 'humanoid' | 'undead',
      enemyClassId,
      isBoss,
      isSubBoss: isSubBossEncounter,
            isDefending: false,
            impulso: 0,
            impulseGuardLevel: 0,
            statusEffects: [],
                assets: gltfMonsterTemplate ? undefined : enemyTemplate.assets,
      attackStyle: gltfMonsterTemplate ? gltfMonsterTemplate.attackStyle : enemyTemplate.attackStyle,
            guaranteedDrops: gltfMonsterTemplate ? (gltfMonsterTemplate.rareDrops ? undefined : undefined) : templateCombatProfile.guaranteedDrops,
            rareDrops: gltfMonsterTemplate ? gltfMonsterTemplate.rareDrops : templateCombatProfile.rareDrops,
            gltfModelUrl: gltfMonsterTemplate
              ? (gltfMonsterTemplate.bodyType === 'Flying'
                  ? new URL(`./game/assets/Characters/Monsters/Monsters/Flying/${gltfMonsterTemplate.gltfFile}`, import.meta.url).href
                  : new URL(`./game/assets/Characters/Monsters/Monsters/Big/${gltfMonsterTemplate.gltfFile}`, import.meta.url).href)
              : undefined,
            element: gltfMonsterTemplate ? gltfMonsterTemplate.element : undefined,
            gltfBodyType: gltfMonsterTemplate ? gltfMonsterTemplate.bodyType as GltfMonsterBodyType : undefined,
            archetipo: gltfMonsterTemplate ? gltfMonsterTemplate.archetipo : undefined,
            manaRegenOnDefend: combatProfile.manaRegenOnDefend,
            potionCharges: combatProfile.potionCharges,
            potionHealValue: combatProfile.potionHealValue,
            lastAction: 'none',
            aiTurnCounter: 0,
            stealAttemptsUsed: 0,
            maxStealAttempts: 3,
            lastStealTurn: -99,
            stolenGoldTotal: 0,
            maxGoldStealPerBattle: Math.max(1, Math.floor(goldReward * 0.5)),
            stolenItems: [],
            aiProfile: {
                tier: combatProfile.tier,
                lowHpThreshold: combatProfile.lowHpThreshold,
                criticalHpThreshold: combatProfile.criticalHpThreshold,
                lowManaThreshold: combatProfile.lowManaThreshold,
                defendBaseChance: combatProfile.defendBaseChance,
                reactToPlayerAction: true,
                critChanceBonus: combatProfile.critChanceBonus,
                critDamageBonus: combatProfile.critDamageBonus,
            },
            skillSet: combatProfile.skillSet,
            combatBuffs: {
                atkMod: hasStrongCycleBoost ? Math.min(0.36, 0.18 + (combatProfile.cycleStrength * 0.05)) : 0,
                defMod: hasStrongCycleBoost ? Math.min(0.34, 0.16 + (combatProfile.cycleStrength * 0.05)) : 0,
                turns: hasStrongCycleBoost ? 2 : 0,
            },
    };

    setEnemyIntentPreview({
        type: Math.random() < Math.max(0.2, Math.min(0.8, combatProfile.defendBaseChance + 0.35)) ? 'defend' : 'attack',
        probability: 80,
    });
    setEnemy(newEnemy);
    // Resetar estado de grupo
    setAdditionalEnemies([]);
    setAccumulatedGroupRewards({ gold: 0, xp: 0 });
    setPrimaryEnemyId(newEnemy.id);
    setMainEnemySlotIndex(0);
    // Slot assignment inicial: só o inimigo principal no slot 0
    setEnemySlotAssignments({ [newEnemy.id]: 0 });
    setInitialGroupSize(1);
    activeBattleActorIdRef.current = null;
    setActiveBattleActorId(null);
    setBattleTimelineState('RUNNING');

    // Spawn de inimigos extras: apenas caça, fase >= 4, inimigo regular (não boss/subboss)
    if (mode === 'hunt' && currentStage >= 4 && !isBoss && !isSubBossEncounter) {
      const extraChance = currentStage >= 8 ? 0.55 : 0.40;
      if (Math.random() < extraChance) {
        const maxExtra = currentStage >= 8 ? 2 : 1;
        const extraCount = maxExtra === 2 ? (Math.random() < 0.5 ? 1 : 2) : 1;

        // Pool de monstros GLTF diferentes do principal para variedade
        const usedIds = new Set<string>([gltfMonsterTemplate?.id ?? '']);
        const extras: Enemy[] = Array.from({ length: extraCount }, (_, k) => {
          // Escolhe um monstro aleatório diferente do principal e dos já escolhidos
          const candidates = GLTF_MONSTER_BESTIARY.filter(t => !usedIds.has(t.id));
          const tmpl = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : GLTF_MONSTER_BESTIARY[Math.floor(Math.random() * GLTF_MONSTER_BESTIARY.length)];
          usedIds.add(tmpl.id);

          const extraGltfUrl = tmpl.bodyType === 'Flying'
            ? new URL(`./game/assets/Characters/Monsters/Monsters/Flying/${tmpl.gltfFile}`, import.meta.url).href
            : new URL(`./game/assets/Characters/Monsters/Monsters/Big/${tmpl.gltfFile}`, import.meta.url).href;

          return {
            ...newEnemy,
            id: `enemy_extra_${Date.now()}_${k}`,
            name: tmpl.name,
            color: tmpl.color,
            scale: tmpl.scale * 0.9,
            gltfModelUrl: extraGltfUrl,
            gltfBodyType: tmpl.bodyType as GltfMonsterBodyType,
            attackStyle: tmpl.attackStyle,
            element: tmpl.element,
            archetipo: tmpl.archetipo,
            assets: undefined,
            isBoss: false as const,
            isSubBoss: false as const,
            stats: {
              ...newEnemy.stats,
              hp: Math.floor(newEnemy.stats.maxHp * 0.80),
              maxHp: Math.floor(newEnemy.stats.maxHp * 0.80),
              atk: Math.floor(newEnemy.stats.atk * 0.80),
              def: Math.floor(newEnemy.stats.def * 0.80),
              magic: Math.floor(newEnemy.stats.magic * 0.80),
                            speed: Math.max(getEnemyClassBaseSpeedFloor(newEnemy.enemyClassId ?? 'knight'), Math.floor(newEnemy.stats.speed * (0.90 + Math.random() * 0.20))),
            },
            xpReward: Math.floor(newEnemy.xpReward * 0.60),
            goldReward: Math.floor(newEnemy.goldReward * 0.60),
            skillSet: newEnemy.skillSet.map(s => ({ ...s, currentCooldown: 0 })),
            aiTurnCounter: 0,
            stealAttemptsUsed: 0,
            lastStealTurn: -99,
            stolenGoldTotal: 0,
            stolenItems: [],
            impulso: 0,
            impulseGuardLevel: 0,
            isDefending: false,
            statusEffects: [],
            lastAction: 'none' as const,
          };
        });
        setAdditionalEnemies(extras);
        // Build stable slot assignments: main=0, extra_0=1, extra_1=2
        const newSlotAssignments: Record<string, number> = { [newEnemy.id]: 0 };
        extras.forEach((e, i) => { newSlotAssignments[e.id] = i + 1; });
        setEnemySlotAssignments(newSlotAssignments);
        setInitialGroupSize(1 + extras.length);
        if (extraCount > 1) {
          addLog(`${newEnemy.name} apareceu com ${extraCount} aliados!`, 'crit');
        } else {
          addLog(`${newEnemy.name} não está sozinho!`, 'crit');
        }
      }
    }

        setEnemyAnimationAction('battle-idle');
        if (newEnemy.combatBuffs.turns > 0) {
            addLog(`${newEnemy.name} iniciou a luta com impulso inicial (+ATK/+DEF).`, 'buff');
        }
        if (isBoss) {
            setNarration(isDungeonEncounter ? 'O soberano da dungeon despertou.' : `O CHEFAO DA FASE ${currentStage} RUGIU!`);
        } else if (isSubBossEncounter) {
            addLog(
                isDungeonEncounter
                    ? `${newEnemy.name} surgiu no 5o encontro da fase da dungeon.`
                    : `${newEnemy.name} surgiu no marco 5/10 da fase.`,
                'crit'
            );
            setNarration(
                isDungeonEncounter
                    ? `SUBCHEFE da dungeon avistado na fase ${currentStage}!`
                    : `SUBCHEFE avistado na fase ${currentStage}!`
            );
        } else {
            setNarration(isDungeonEncounter ? 'Uma presenca da dungeon bloqueia seu caminho.' : 'Um inimigo se aproxima...');
        }
    
    try {
        const flavor = await generateBattleDescription(newEnemy.name, newEnemy.level);
        setNarration(flavor);
    } catch (e) {
        console.log("GenAI skipped");
    }
  };

    const handleContinueFromSave = () => {
        if (!selectedSlotSummary?.hasSave) {
            return;
        }

        const restored = applyLoadedSave(selectedSlotSummary.slotId);
        if (!restored) {
            const slots = refreshSaveSlotCatalog();
            setHasSavePromptDecision(!slots.some((slot) => slot.hasSave));
        }
    };

    const handleNewGameFromSlot = () => {
        if (!firstAvailableEmptySlotId) {
            return;
        }

        setSelectedSaveSlotId(firstAvailableEmptySlotId);
        setActiveSaveSlotId(firstAvailableEmptySlotId);
        setHasSavePromptDecision(true);
        lastSavedSignatureRef.current = '';
    };
    // Ref sempre fresco para uso no handler de gamepad (closure estável)
    handleNewGameFromSlotRef.current = handleNewGameFromSlot;
    openClearModalRef.current = () => { setShowClearSaveConfirmModal(true); requestAnimationFrame(() => setClearSaveModalVisible(true)); };
    setSelectedSaveSlotIdRef.current = setSelectedSaveSlotId;

    const handleClearSelectedSaveSlot = () => {
        if (!selectedSlotSummary?.hasSave) {
            return;
        }

        clearSlot(selectedSlotSummary.slotId);
        const slots = refreshSaveSlotCatalog();
        const nextSlotId = slots.find((slot) => slot.hasSave)?.slotId
            ?? slots.find((slot) => !slot.hasSave)?.slotId
            ?? 1;

        setSelectedSaveSlotId(nextSlotId);
        setActiveSaveSlotId(nextSlotId);
        lastSavedSignatureRef.current = '';
        setShowClearSaveConfirmModal(false);
    };

    const startGame = (classId: Player['classId'] = selectedStartingClassId) => {
        const startingPlayer = createStartingPlayer(classId);
    setActiveSaveSlotId(selectedSaveSlotId);
    setStage(1);
    setKillCount(0);
        setDungeonEvolution(0);
        setDungeonSubBossDefeatedEvolution(null);
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
    setShopReturnToInventory(false);
    setOpenInventoryFromShopToken(0);
    setOpenInventoryFromShopFilter('all');
    setShopReturnInventoryFilter('all');
    setPlayerAnimationAction('idle');
    setEnemyAnimationAction('battle-idle');
    setSceneRegion('forest');
    setOnboardingPhase('intro_camp');
    setHasPlayerDiedOnce(false);
        setSkillsUnlockPromptPending(false);
    setImpulseUnlockPromptQueue([]);
        setConstellationUnlockPromptPending(false);
        setConstellationRespecUnlockPromptPending(false);
        setConstellationRespecPromptSeen(false);
        setHasDiamondHudUnlocked(false);
        setDiamondUnlockPromptPending(false);
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
                dungeonSubBossDefeatedEvolution: null,
                onboardingPhase: 'intro_camp',
                hasPlayerDiedOnce: false,
                skillsActionUnlocked: false,
                skillsUnlockPromptPending: false,
                impulseUnlockPromptQueue: [],
                constellationUnlockPromptPending: false,
                constellationRespecUnlockPromptPending: false,
                constellationRespecPromptSeen: false,
                hasDiamondHudUnlocked: false,
                gameState: GameState.TAVERN,
                turnState: TurnState.PLAYER_INPUT,
                hasEnemy: false,
                hadDungeonRun: false,
                cardRewardQueue: [],
                currentCardOffer: null,
                currentCardChoices: [],
                postCardFlow: null,
                dungeonRun: null,
                dungeonResult: null,
                bossVictoryContext: null,
                pendingDungeonQueue: [],
                logs: [],
                narration: '',
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

  const handleOpenPortalTravel = useCallback(() => {
            if (gameState !== GameState.TAVERN) {
                return;
            }
            setPortalInspectMode(true);
  }, [gameState]);

  const handleNavigateSceneRegion = useCallback((targetRegion: SceneRegion) => {
            const dungeonPortalUnlocked = onboardingPhase === 'dungeon_prompt'
                || onboardingPhase === 'dungeon_unlocked'
                || onboardingPhase === 'alchemist_prompt'
                || onboardingPhase === 'alchemist_unlocked';

            if (targetRegion === 'dungeon' && !dungeonPortalUnlocked) {
                return;
            }
            if (targetRegion === sceneRegion) {
                return;
            }

            // Hide action buttons for the full cinematic duration (zoom-in 0.72s +
            // hold 0.24s + zoom-out 0.82s ≈ 1.8s) plus a small buffer.
            setPortalTransitioning(true);
            if (portalTransitionClearTimerRef.current !== null) {
                window.clearTimeout(portalTransitionClearTimerRef.current);
            }
            portalTransitionClearTimerRef.current = window.setTimeout(() => {
                portalTransitionClearTimerRef.current = null;
                setPortalTransitioning(false);
            }, 3200);

            // Timeline:
            // t=0→720ms  : zoom-in visível (sem overlay)
            // t=720ms     : overlay fade-in rápido (200ms)
            // t=920ms     : overlay opaco → troca de cena + overlay some (fade-out 600ms)
            // t=960ms     : zoom-out começa no novo cenário — VISÍVEL ao usuário
            // t=1520ms    : overlay totalmente transparente, zoom-out termina ~t=1780ms

            setMenuPortalTravelCinematicToken((prev) => prev + 1);

            if (portalTravelRegionSwapTimerRef.current !== null) {
                window.clearTimeout(portalTravelRegionSwapTimerRef.current);
            }

            // Wipe-in starts at t=500ms — slightly before zoom-in ends (720ms),
            // creating a smooth overlap where the circle opens as the camera arrives.
            window.setTimeout(() => {
                setPortalSceneOverlay({ targetRegion, phase: 'in' });
            }, 500);

            portalTravelRegionSwapTimerRef.current = window.setTimeout(() => {
                portalTravelRegionSwapTimerRef.current = null;
                // Wipe-in already running — swap scene, then hold before wipe-out
                setSceneRegion(targetRegion);
                // Hold: wipe-in duration (380ms) + scene load buffer
                // Total from start: 500 + 380 + hold = scene fully opaque at ~880ms
                window.setTimeout(() => {
                    setPortalSceneOverlay({ targetRegion, phase: 'out' });
                    window.setTimeout(() => setPortalSceneOverlay(null), 620);
                }, 1800);
            }, PORTAL_TRAVEL_CAMERA_ZOOM_MS); // 720ms — zoom-in ends
  }, [onboardingPhase, sceneRegion]);

  // ── Diário de Missões: callbacks ────────────────────────────────────────
  const recordKillForMissions = useCallback((meta: { isBoss: boolean; element?: string; bodyType?: string; archetipo?: string }) => {
    const types: MissionActionType[] = ['KILL_ENEMY'];
    if (meta.bodyType === 'Flying') types.push('KILL_FLYING');
    if (meta.element === 'sombrio') types.push('KILL_ELEMENT_DARK');
    if (meta.element === 'fogo') types.push('KILL_ELEMENT_FIRE');
    if (meta.element === 'terra') types.push('KILL_ELEMENT_TERRA');
    if (meta.element === 'agua') types.push('KILL_ELEMENT_AGUA');
    if (meta.element === 'vento') types.push('KILL_ELEMENT_VENTO');
    if (meta.archetipo === 'ladino') types.push('KILL_ARCHETYPE_ROGUE');
    if (meta.archetipo === 'barbaro') types.push('KILL_ARCHETYPE_BARBARIAN');
    if (meta.archetipo === 'mago') types.push('KILL_ARCHETYPE_MAGE');
    if (meta.archetipo === 'guerreiro') types.push('KILL_ARCHETYPE_WARRIOR');
    if (meta.archetipo === 'atirador') types.push('KILL_ARCHETYPE_RANGER');
    if (meta.archetipo === 'dragao') types.push('KILL_ARCHETYPE_DRAGON');
    if (meta.archetipo === 'demonio') types.push('KILL_ARCHETYPE_DEMON');
    if (meta.archetipo === 'orc') types.push('KILL_ARCHETYPE_ORC');
    if (meta.isBoss) types.push('KILL_BOSS');
    setMissions(prev => {
      const next = prev.map(m => {
        if (!types.includes(m.tipoMissao)) return m;
        return { ...m, progressoAtual: m.progressoAtual + 1 };
      });
      // Fire toast for any mission that just hit 100%
      const justCompleted = next.find((m, i) => {
        const old = prev[i];
        return m.progressoAtual >= m.metaAtual && old.progressoAtual < old.metaAtual;
      });
      if (justCompleted) {
        const desc = justCompleted.descricao.replace('{meta}', String(justCompleted.metaAtual));
        setMissionToast({ id: justCompleted.id + '_' + Date.now(), title: desc, reward: justCompleted.recompensaAtual });
      }
      return next;
    });
  }, []);

  const checkStageMissions = useCallback((currentStage: number) => {
    setMissions(prev => {
      const next = prev.map(m => {
        if (m.tipoMissao !== 'REACH_STAGE') return m;
        if (currentStage >= m.metaAtual && m.progressoAtual < m.metaAtual) {
          return { ...m, progressoAtual: m.metaAtual };
        }
        return m;
      });
      const justCompleted = next.find((m, i) => {
        const old = prev[i];
        return m.progressoAtual >= m.metaAtual && old.progressoAtual < old.metaAtual;
      });
      if (justCompleted) {
        const desc = justCompleted.descricao.replace('{meta}', String(justCompleted.metaAtual));
        setMissionToast({ id: justCompleted.id + '_' + Date.now(), title: desc, reward: justCompleted.recompensaAtual });
      }
      return next;
    });
  }, []);

  const claimMissionReward = useCallback((missionId: string) => {
    // Read current missions synchronously via functional updater to avoid stale closure
    let updatedMissions: Mission[] | null = null;
    let goldReward = 0;
    setMissions(prev => {
      const idx = prev.findIndex(m => m.id === missionId);
      if (idx < 0) return prev;
      const m = prev[idx];
      if (m.progressoAtual < m.metaAtual) return prev;
      goldReward = m.recompensaAtual;
      const isFixed = m.metaIncrement === 0;
      const nextNivel = m.nivelAtual + 1;
      const nextMeta = isFixed
        ? m.metaBase
        : Math.max(1, Math.round(m.metaAtual * 1.30));
      const nextRecompensa = isFixed
        ? m.recompensaBase
        : Math.round(m.recompensaAtual * 1.30);
      const updated = [...prev];
      updated[idx] = { ...m, progressoAtual: 0, nivelAtual: nextNivel, metaAtual: nextMeta, recompensaAtual: nextRecompensa };
      updatedMissions = updated;
      return updated;
    });
    // setPlayer and save OUTSIDE the updater to avoid side-effects in render phase
    if (goldReward > 0) {
      setPlayer(p => ({ ...p, gold: p.gold + goldReward }));
    }
    if (updatedMissions) {
      const snapshot = (updatedMissions as Mission[]).map(x => ({ ...x }));
      // Use ref so we always call the freshest persistSaveNow (never stale during battle)
      setTimeout(() => persistSaveNowRef.current({ missions: snapshot }), 50);
    }
  }, []);

  useEffect(() => {
    if (sceneRegion === 'forest') checkStageMissions(stage);
  }, [stage, sceneRegion, checkStageMissions]);

  const enterBattleImmediate = (isBoss: boolean, mode: 'hunt' | 'dungeon' = dungeonRun ? 'dungeon' : 'hunt', dungeonClearedOverride?: number) => {
            const isDungeonBattle = mode === 'dungeon';
            if (mode === 'hunt'
                && hasPlayerDiedOnce
                && onboardingPhase === 'inventory_unlocked') {
                setOnboardingPhase('missions_prompt');
            }
            if (mode === 'hunt' && onboardingPhase === 'merchant_unlocked') {
                setOnboardingPhase('items_prompt');
            }
            setSceneRegion(isDungeonBattle ? 'dungeon' : 'forest');
            const dungeonCleared = dungeonClearedOverride ?? dungeonRun?.rewards.clearedMonsters ?? 0;
            const activeDungeonEvolution = dungeonRun?.evolution ?? dungeonEvolution;
            const encounterStage = isDungeonBattle ? getDungeonPhaseFromEvolution(activeDungeonEvolution) : stage;
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
                if ((prev.cardBonuses.openingCounterAttackBoost ?? 0) > 0) {
                    nextBuffs.counterChanceBoost = Math.max(nextBuffs.counterChanceBoost, prev.cardBonuses.openingCounterAttackBoost ?? 0);
                    nextBuffs.counterChanceBoostTurns = Math.max(nextBuffs.counterChanceBoostTurns, 2);
                }
                return {
                    ...prev,
                    buffs: nextBuffs,
                    isDefending: false,
                    isDefendendo: false,
                    tipoDefesaAtiva: null,
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
            setTurnState(TurnState.PROCESSING);
    setEnemyAnimationAction('battle-idle');
      setEnemy(null);
      setAdditionalEnemies([]);
            clearGauges();
            activeBattleActorIdRef.current = null;
            setActiveBattleActorId(null);
            setBattleTimelineState('RUNNING');
      setLogs([]);
      const shouldSpawnBoss = isDungeonBattle
          ? isBoss
          : (isBoss || (killCount + 1 >= getHuntPhaseLength(encounterStage)));
      spawnEnemy(encounterStage, shouldSpawnBoss, mode, isDungeonBattle ? activeDungeonEvolution : undefined);
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
            ...(() => {
                let adjustedStats = { ...prev.stats };
                const adjustedInventory = { ...prev.inventory };
                const equippedWeapon = prev.equippedWeapon;

                const previousClassBonuses = getWeaponProficiencyAppliedBonuses(prev.classId, equippedWeapon);
                if (hasWeaponProficiencyBonuses(previousClassBonuses)) {
                    adjustedStats = applyWeaponProficiencyBonusesToStats(adjustedStats, previousClassBonuses, -1);
                }

                const nextEquippedWeapon = equippedWeapon;

                const classApplied = applyPlayerClass({ ...prev, inventory: adjustedInventory, stats: adjustedStats, equippedWeapon: nextEquippedWeapon }, classId);
                let classAppliedStats = { ...classApplied.stats };
                const nextClassBonuses = getWeaponProficiencyAppliedBonuses(classId, nextEquippedWeapon);
                if (hasWeaponProficiencyBonuses(nextClassBonuses)) {
                    classAppliedStats = applyWeaponProficiencyBonusesToStats(classAppliedStats, nextClassBonuses, 1);
                }

                return {
                    ...classApplied,
                    inventory: adjustedInventory,
                    stats: classAppliedStats,
                    equippedWeapon: nextEquippedWeapon,
                };
            })(),
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
                                onActorTurnDone();
      }, 1000);
    }, 800);
  };

  // ---- Tower handlers ----

  const handleEnterTower = useCallback(() => {
      uiSfx.play('modal_open');
      setSceneRegion('tower');
      setGameState(GameState.TOWER_HUB);
  }, []);

  const handleStartTowerRun = useCallback((slots: ConsumableSlot[]) => {
      const run = buildTowerRunState(player, towerMeta, slots);
      setTowerRun(run);
      setTowerRunItems([]);
      setGameState(GameState.TOWER_MAP);
  }, [player, towerMeta]);

  const handleUpgradeTowerSlots = useCallback(() => {
      const nextLevel = towerMeta.consumableSlotsLevel + 1;
      const cost = TOWER_CONSUMABLE_UPGRADE_COST[nextLevel];
      if (!cost || towerMeta.essence < cost) return;
      setTowerMeta(prev => ({ ...prev, essence: prev.essence - cost, consumableSlotsLevel: nextLevel }));
  }, [towerMeta]);

  const handleTowerVictory = useCallback(() => {
      const run = towerRunRef.current;
      if (!run) return;
      const nodeId = run.selectedNodeId;
      if (!nodeId) return;
      const newMap = completeNode(run.currentFloorMap, nodeId);
      const isBossFloor = [5, 10, 15].includes(run.floor);
      const essenceEarned = calculateEssenceReward(run.floor);
      const updatedRun: TowerRunState = {
          ...run,
          currentFloorMap: newMap,
          completedNodeIds: [...run.completedNodeIds, nodeId],
          selectedNodeId: null,
          accumulatedRewards: { ...run.accumulatedRewards, essenceEarned: run.accumulatedRewards.essenceEarned + essenceEarned },
      };
      setTowerRun(updatedRun);
      setSceneRegion('forest');
      if (isBossFloor) {
          const sanctuaryOpts = getSanctuaryOptions(run.floor, run.act);
          setTowerSanctuaryOptions(sanctuaryOpts);
          setGameState(GameState.TOWER_SANCTUARY);
      } else {
          setGameState(GameState.TOWER_MAP);
      }
  }, []);

  const handleTowerDeath = useCallback(() => {
      const run = towerRunRef.current;
      if (!run) return;
      const restoredPlayer = resolveTowerDeath(run);
      setPlayer(clonePlayer(restoredPlayer));
      setTowerResultOutcome('defeat');
      setGameState(GameState.TOWER_RESULT);
  }, []);

  const handleTowerSanctuaryChoose = useCallback((option: TowerSanctuaryOption) => {
      setTowerRun(prev => {
          if (!prev) return null;
          let updatedRun = { ...prev };
          if (option.cardId) {
              const card = TOWER_RUN_CARDS.find(c => c.id === option.cardId);
              if (card) updatedRun.runCards = [...updatedRun.runCards, card];
          }
          return advanceToNextFloor(updatedRun);
      });
      if (option.healPercent) {
          const pct = option.healPercent;
          setPlayer(prev => ({ ...prev, stats: { ...prev.stats, hp: Math.min(prev.stats.maxHp, prev.stats.hp + Math.floor(prev.stats.maxHp * (pct / 100))) } }));
      }
      if (option.goldAmount && option.goldAmount > 0) {
          const amt = option.goldAmount;
          setPlayer(prev => ({ ...prev, gold: prev.gold + amt }));
      }
      if (option.tradeHpForAtk) {
          const loss = option.tradeHpForAtk;
          setPlayer(prev => ({ ...prev, stats: { ...prev.stats, maxHp: prev.stats.maxHp - loss, atk: prev.stats.atk + 12 } }));
      }
      setGameState(GameState.TOWER_MAP);
  }, []);

  const handleTowerNodeSelect = useCallback((node: TowerNode) => {
      setTowerRun(prev => prev ? { ...prev, selectedNodeId: node.id } : null);
      switch (node.type) {
          case TowerNodeType.HEAL: {
              setPlayer(prev => ({ ...prev, stats: { ...prev.stats, hp: Math.min(prev.stats.maxHp, prev.stats.hp + Math.floor(prev.stats.maxHp * 0.30)) } }));
              setTowerRun(prev => {
                  if (!prev) return null;
                  const newMap = completeNode(prev.currentFloorMap, node.id);
                  return { ...prev, currentFloorMap: newMap, selectedNodeId: null, completedNodeIds: [...prev.completedNodeIds, node.id] };
              });
              break;
          }
          case TowerNodeType.EVENT: {
              const event = TOWER_EVENTS[Math.floor(Math.random() * TOWER_EVENTS.length)];
              setTowerActiveEvent(event);
              break;
          }
          case TowerNodeType.UPGRADE: {
              setTowerRun(prev => {
                  if (!prev) return null;
                  const offer = getRunCardOffer(prev.runCards.map(c => c.id));
                  setTowerCardOffer(offer);
                  return prev;
              });
              break;
          }
          case TowerNodeType.SHOP: {
              const shopItems = getTowerShopItems(ALL_ITEMS);
              setTowerShopItems(shopItems);
              break;
          }
          case TowerNodeType.CHEST: {
              const goldReward = 50 + Math.floor(Math.random() * 80);
              setPlayer(prev => ({ ...prev, gold: prev.gold + goldReward }));
              setTowerRun(prev => {
                  if (!prev) return null;
                  const newMap = completeNode(prev.currentFloorMap, node.id);
                  return { ...prev, currentFloorMap: newMap, selectedNodeId: null, completedNodeIds: [...prev.completedNodeIds, node.id], accumulatedRewards: { ...prev.accumulatedRewards, gold: prev.accumulatedRewards.gold + goldReward } };
              });
              break;
          }
          default: {
              // COMBAT, ELITE, RANDOM — enter battle
              const run = towerRunRef.current;
              if (!run) break;
              const isBoss = run.floor % 5 === 0;
              enterBattle(isBoss, 'dungeon');
              break;
          }
      }
  }, [enterBattle]);

  const handleTowerEventChoice = useCallback((option: TowerEventOption) => {
      const effect = option.effect;
      if (effect.type === 'gold' && effect.amount > 0) {
          setPlayer(prev => ({ ...prev, gold: prev.gold + effect.amount }));
      } else if (effect.type === 'heal') {
          const pct = effect.percent;
          setPlayer(prev => ({ ...prev, stats: { ...prev.stats, hp: Math.min(prev.stats.maxHp, prev.stats.hp + Math.floor(prev.stats.maxHp * (pct / 100))) } }));
      } else if (effect.type === 'hp_loss') {
          const pct = effect.percent;
          setPlayer(prev => ({ ...prev, stats: { ...prev.stats, hp: Math.max(1, prev.stats.hp - Math.floor(prev.stats.maxHp * (pct / 100))) } }));
      } else if (effect.type === 'card') {
          const card = TOWER_RUN_CARDS.find(c => c.id === effect.cardId);
          if (card) setTowerRun(prev => prev ? { ...prev, runCards: [...prev.runCards, card] } : null);
      }
      setTowerActiveEvent(null);
      setTowerRun(prev => {
          if (!prev || !prev.selectedNodeId) return prev;
          const nodeId = prev.selectedNodeId;
          const newMap = completeNode(prev.currentFloorMap, nodeId);
          return { ...prev, currentFloorMap: newMap, selectedNodeId: null, completedNodeIds: [...prev.completedNodeIds, nodeId] };
      });
  }, []);

  const handleTowerCardPick = useCallback((card: RunCard) => {
      setTowerRun(prev => {
          if (!prev || !prev.selectedNodeId) return prev;
          const nodeId = prev.selectedNodeId;
          const newMap = completeNode(prev.currentFloorMap, nodeId);
          return { ...prev, currentFloorMap: newMap, selectedNodeId: null, completedNodeIds: [...prev.completedNodeIds, nodeId], runCards: [...prev.runCards, card] };
      });
      setTowerCardOffer(null);
  }, []);

  const handleTowerShopBuy = useCallback((item: Item) => {
      setPlayer(prev => {
          if (prev.gold < item.cost) return prev;
          return { ...prev, gold: prev.gold - item.cost, inventory: { ...prev.inventory, [item.id]: (prev.inventory[item.id] ?? 0) + 1 } };
      });
  }, []);

  const handleTowerReturnToHub = useCallback(() => {
      const run = towerRunRef.current;
      if (!run) { setGameState(GameState.TAVERN); return; }
      const rewards = run.accumulatedRewards;
      const restoredPlayer = resolveTowerDeath(run);
      const withRewards = applyTowerRunRewardsToPlayer(restoredPlayer, rewards);
      setPlayer(clonePlayer(withRewards));
      setTowerMeta(prev => ({
          ...prev,
          essence: prev.essence + rewards.essenceEarned,
          highestFloor: Math.max(prev.highestFloor, run.floor),
          highestLoop: Math.max(prev.highestLoop, run.loop),
      }));
      setTowerRun(null);
      setTowerActiveEvent(null);
      setTowerCardOffer(null);
      setTowerShopItems(null);
      setGameState(GameState.TAVERN);
      setSceneRegion('forest');
  }, []);

  // ---- End tower handlers ----

  const handleFlee = () => {
      if (towerRun) {
          // In tower — flee is a withdrawal
          handleTowerDeath();
          setTowerResultOutcome('withdrawal');
          return;
      }
      if (dungeonRun) {
          return;
      }

    const canLeaveFreely = killCount >= (getHuntPhaseLength(stage) - 1);
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
          isDefendendo: false,
          tipoDefesaAtiva: null,
          buffs: createEmptyBuffState() // Reset buffs on flee
      }));
      setKillCount(0);

      addLog(canLeaveFreely ? 'Saiu da batalha sem custo, recuperou toda a vida e reiniciou a fase.' : `Fugiu! Perdeu ${lostGold} Ouro, recuperou toda a vida e voltou ao inicio da fase.`, "info");
      setGameState(GameState.TAVERN);
      setEnemy(null);
  }

  const respawnAtCamp = () => {
      setOnboardingPhase((prev) => {
          if (prev === 'merchant_prompt'
              || prev === 'merchant_unlocked'
              || prev === 'items_prompt'
              || prev === 'flee_prompt'
              || prev === 'flee_unlocked'
              || prev === 'dungeon_prompt'
              || prev === 'dungeon_unlocked'
              || prev === 'alchemist_prompt'
              || prev === 'alchemist_unlocked') {
              return prev;
          }

          // Não pular missões — o desbloqueio ocorre via enterBattleImmediate
          if (ONBOARDING_PHASES.indexOf(prev) < ONBOARDING_PHASES.indexOf('missions_unlocked')) {
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
          isDefendendo: false,
          tipoDefesaAtiva: null,
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

    const DUNGEON_COMMON_MATERIAL_POOL = [
        ...MATERIALS.filter((item) => item.type === 'material' && item.rarity === 'bronze').map((item) => item.id),
        'mat_dg_coal',
        'mat_dg_copper_ore',
        'mat_dg_limestone',
        'mat_dg_moss_fiber',
        'mat_dg_fossil_bone',
        'mat_dg_cracked_shell',
        'mat_dg_salt_crystal',
        'mat_dg_rusty_chain',
        'mat_dg_dark_clay',
        'mat_dg_sulfur_powder',
    ];

    const DUNGEON_RARE_MATERIAL_POOL = [
        'mat_iron',
        'mat_dg_silver_ore',
        'mat_dg_moonstone',
        'mat_dg_amber_resin',
        'mat_dg_shadow_ink',
        'mat_dg_arcane_dust',
        'mat_dg_steel_nodule',
        'mat_dg_cobalt_shard',
        'mat_dg_onyx_chip',
        'mat_dg_ghost_essence',
        'mat_dg_lumen_pearl',
    ];

    const DUNGEON_LEGENDARY_MATERIAL_POOL = [
        'mat_gold',
        'mat_dg_emerald_cluster',
        'mat_dg_ruby_prism',
        'mat_dg_sapphire_core',
        'mat_dg_void_opal',
        'mat_dg_dragonite_heart',
        'mat_dg_star_diamond',
    ];

    const isDungeonMaterialRarityUnlocked = (rarity: Item['rarity'], evolution: number) => {
        if (rarity === 'bronze') return true;
        if (rarity === 'silver') return evolution >= 5;
        return evolution >= 10;
    };

    const isDropUnlockedForDungeonEvolution = (itemId: string, evolution: number) => {
        const item = ALL_ITEMS.find((entry) => entry.id === itemId);
        if (!item || item.type !== 'material') {
            return true;
        }
        return isDungeonMaterialRarityUnlocked(item.rarity, evolution);
    };

    const getDungeonBaseDrop = (evolution: number) => {
        if (evolution < 5) {
            return pickRandom(DUNGEON_COMMON_MATERIAL_POOL);
        }

        if (evolution < 10) {
            return Math.random() < 0.6
                ? pickRandom(DUNGEON_COMMON_MATERIAL_POOL)
                : pickRandom(DUNGEON_RARE_MATERIAL_POOL);
        }

        const roll = Math.random();
        if (roll < 0.4) {
            return pickRandom(DUNGEON_COMMON_MATERIAL_POOL);
        }
        if (roll < 0.7) {
            return pickRandom(DUNGEON_RARE_MATERIAL_POOL);
        }
        return pickRandom(DUNGEON_LEGENDARY_MATERIAL_POOL);
    };

    const generateDungeonDrops = (targetEnemy: Enemy, evolution: number, wasBoss: boolean) => {
        const rewardDrops: string[] = [];
        const dungeonPhase = getDungeonPhaseFromEvolution(evolution);

        if (wasBoss) {
            if (dungeonPhase <= 5) {
                rewardDrops.push(...pickRandomMany(DUNGEON_COMMON_MATERIAL_POOL, 1));
                rewardDrops.push(...pickRandomMany(DUNGEON_RARE_MATERIAL_POOL, 2));
            } else if (dungeonPhase <= 10) {
                rewardDrops.push(...pickRandomMany(DUNGEON_RARE_MATERIAL_POOL, 2));
                rewardDrops.push(...pickRandomMany(DUNGEON_LEGENDARY_MATERIAL_POOL, 1));
            } else {
                rewardDrops.push(...pickRandomMany(DUNGEON_RARE_MATERIAL_POOL, 1));
                rewardDrops.push(...pickRandomMany(DUNGEON_LEGENDARY_MATERIAL_POOL, 2));
            }
            return rewardDrops.slice(0, 3);
        }

        if (Math.random() < 0.92) {
            rewardDrops.push(getDungeonBaseDrop(evolution));
        }

        targetEnemy.guaranteedDrops?.forEach(dropId => {
            if (!isDropUnlockedForDungeonEvolution(dropId, evolution)) {
                return;
            }
            rewardDrops.push(dropId);
        });

        targetEnemy.rareDrops?.forEach(drop => {
            if (drop.itemId === 'pot_dg_elixir' && evolution < 8) {
                return;
            }
            if (drop.itemId === 'pot_dg_ambrosia' && evolution < 15) {
                return;
            }
            if (!isDropUnlockedForDungeonEvolution(drop.itemId, evolution)) {
                return;
            }
            const finalChance = Math.min(0.92, drop.chance + (evolution * 0.02));
            if (Math.random() < finalChance) {
                rewardDrops.push(drop.itemId);
            }
        });

        if (Math.random() < Math.min(0.45, 0.12 + (evolution * 0.03))) {
            rewardDrops.push(Math.random() < 0.55 ? 'pot_dg_mana' : 'pot_3');
        }

        if (rewardDrops.length === 0) {
            rewardDrops.push(getDungeonBaseDrop(evolution));
        }

        const cappedDrops = rewardDrops.slice(0, 3);
        if (cappedDrops.length === 0) {
            cappedDrops.push(getDungeonBaseDrop(evolution));
        }

        return cappedDrops;
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
            isDefendendo: false,
            tipoDefesaAtiva: null,
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
    applyLevelProgression,
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
    onFirstDungeonDiamondGain: () => {
        if (!hasDiamondHudUnlocked) {
            setHasDiamondHudUnlocked(true);
            setDiamondUnlockPromptPending(true);
        }
    },
    onDungeonSubBossDefeated: (evolution) => {
        setDungeonSubBossDefeatedEvolution(evolution);
    },
    onLevelUp: showLevelUpModal,
        shouldForceFirstEnemyDrop: onboardingPhase === 'intro_camp',
        shouldTriggerInventoryUnlockTutorial: onboardingPhase === 'intro_camp' || onboardingPhase === 'post_first_hunt',
        onTriggerInventoryUnlockTutorial: () => setOnboardingPhase('inventory_prompt'),
        shouldTriggerConstellationUnlockTutorial: player.talentPoints === 0 && player.unlockedTalentNodeIds.length === 0,
        onTriggerConstellationUnlockTutorial: () => setConstellationUnlockPromptPending(true),
          allowPotionDrops: hasPlayerDiedOnce,
        isTowerBattle: Boolean(towerRun),
        onTowerVictory: handleTowerVictory,
        getAdditionalEnemies: () => additionalEnemiesRef.current,
        onPartialGroupKill,
        onActorTurnDone,
        accumulatedGroupRewards,
        onEnemyKilledForMissions: recordKillForMissions,
  });

  const {
    handleChargeImpulse,
    handleAbsorbImpulse,
    handlePlayerAttack,
    handlePlayerDefense,
    handleSkill,
    handleUseItem,
    handleEnemyTurn,
  } = useBattleController({
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
    setPlayerBowShotTrigger,
    setEnemyBowShotTrigger,
    setPlayerBowShotDidHit,
    setEnemyBowShotDidHit,
    enemyIntentPreview,
        onPlayerDefeat: () => setHasPlayerDiedOnce(true),
        onTowerDefeat: towerRun ? handleTowerDeath : undefined,
        onActorTurnDone,
  });

  useEffect(() => {
    if (turnState === TurnState.ENEMY_TURN && enemy && gameState === GameState.BATTLE) {
            try {
                handleEnemyTurn();
            } catch (error) {
                console.error('Enemy turn crashed and was recovered.', error);
                addLog('A IA do inimigo falhou neste turno. Fluxo recuperado automaticamente.', 'info');
                setIsEnemyAttacking(false);
                setEnemyAnimationAction('battle-idle');
                onActorTurnDone();
            }
    }
    }, [addLog, enemy, gameState, handleEnemyTurn, onActorTurnDone, setEnemyAnimationAction, setIsEnemyAttacking, turnState]);

  // Refs para wrappers de seleção de alvo (sempre frescos)
  const handlePlayerAttackRef = useRef(handlePlayerAttack);
  handlePlayerAttackRef.current = handlePlayerAttack;
  const handleSkillRef = useRef(handleSkill);
  handleSkillRef.current = handleSkill;

  const allEnemiesAlive = [enemy, ...additionalEnemies].filter((e): e is Enemy => Boolean(e) && e!.stats.hp > 0);
  const hasMultipleEnemies = allEnemiesAlive.length > 1;

    const beginPlayerActionExecution = useCallback(() => {
        if (activeBattleActorIdRef.current === 'player') {
            setBattleTimelineState('EXECUTING');
        }
    }, []);

  const handleAttackWithTargetCheck = useCallback(() => {
    if (hasMultipleEnemies) setPendingTargetAction({ type: 'attack' });
        else {
            beginPlayerActionExecution();
            handlePlayerAttackRef.current();
        }
    }, [beginPlayerActionExecution, hasMultipleEnemies]);

  const handleSkillWithTargetCheck = useCallback((skill: Skill) => {
    const isOffensive = skill.type === 'physical' || skill.type === 'magic';
    if (hasMultipleEnemies && isOffensive) setPendingTargetAction({ type: 'skill', skill });
        else {
            beginPlayerActionExecution();
            handleSkillRef.current(skill);
        }
    }, [beginPlayerActionExecution, hasMultipleEnemies]);

    const handlePlayerDefenseWithTimeline = useCallback((tipoDefesa: TipoDefesa) => {
        beginPlayerActionExecution();
        handlePlayerDefense(tipoDefesa);
    }, [beginPlayerActionExecution, handlePlayerDefense]);

    const handleChargeImpulseWithTimeline = useCallback(() => {
        beginPlayerActionExecution();
        handleChargeImpulse();
    }, [beginPlayerActionExecution, handleChargeImpulse]);

    const handleUseItemWithTimeline = useCallback((itemId: string) => {
        beginPlayerActionExecution();
        handleUseItem(itemId);
    }, [beginPlayerActionExecution, handleUseItem]);

  const handleSelectTarget = useCallback((targetId: string) => {
    const all = [enemy, ...additionalEnemies].filter(Boolean) as Enemy[];
    const target = all.find(e => e.id === targetId) ?? null;
    if (!target) { setPendingTargetAction(null); return; }
    // Swap para que o battle controller enxergue o alvo em `enemy`
    setEnemy(target);
    setAdditionalEnemies(all.filter(e => e.id !== targetId));
    setPrimaryEnemyId(targetId);
    // Usa o slot assignment estável → sem teleporte visual
    setMainEnemySlotIndex(enemySlotAssignmentsRef.current[targetId] ?? 0);
    const action = pendingTargetAction;
    setPendingTargetAction(null);
        beginPlayerActionExecution();
    window.setTimeout(() => {
      if (action?.type === 'attack') handlePlayerAttackRef.current();
      else if (action?.type === 'skill') handleSkillRef.current(action.skill);
    }, 0);
    }, [additionalEnemies, beginPlayerActionExecution, enemy, pendingTargetAction]);

  const handleCancelTargetSelection = useCallback(() => {
    setTargetCardLeaving(true);
    setTimeout(() => { setPendingTargetAction(null); setTargetCardLeaving(false); }, 220);
  }, []);

  // ── Gamepad → ações de batalha ──────────────────────────────────────────────
  // Refs sempre frescos para que o useEffect não precise re-assinar
  const handleAttackRef2    = useRef(handleAttackWithTargetCheck);
    const handleDefenseRef    = useRef(handlePlayerDefenseWithTimeline);
    const handleSkillWithTargetCheckRef = useRef(handleSkillWithTargetCheck);
  const handleFleeRef       = useRef(handleFlee);
  handleAttackRef2.current  = handleAttackWithTargetCheck;
    handleDefenseRef.current  = handlePlayerDefenseWithTimeline;
    handleSkillWithTargetCheckRef.current = handleSkillWithTargetCheck;
  handleFleeRef.current     = handleFlee;

  const gameStateRef = useRef(gameState);
  const turnStateRef = useRef(turnState);
  gameStateRef.current = gameState;
  turnStateRef.current = turnState;

  const equippedSkillsRef = useRef(player.equippedSkillIds);
  equippedSkillsRef.current = player.equippedSkillIds;

  useEffect(() => {
    return onAction((action) => {
      if (gameStateRef.current !== GameState.BATTLE) return;
      if (turnStateRef.current !== TurnState.PLAYER_INPUT) return;

      if (action === 'CONFIRM') {
        handleAttackRef2.current();
      } else if (action === 'BACK') {
                handleDefenseRef.current('FISICA');
      } else if (action === 'SKILL_1') {
        // Usa o primeiro skill equipado, se disponível
        const skillId = equippedSkillsRef.current?.[0];
        if (!skillId) return;
        const skill = SKILLS.find(s => s.id === skillId);
        if (skill) handleSkillWithTargetCheckRef.current(skill);
      } else if (action === 'SKILL_2') {
        const skillId = equippedSkillsRef.current?.[1];
        if (!skillId) return;
        const skill = SKILLS.find(s => s.id === skillId);
        if (skill) handleSkillWithTargetCheckRef.current(skill);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enemy) {
      setEnemyIntentPreview(null);
    }
  }, [enemy]);

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
            const shouldTriggerCardsUnlockTutorial = currentCardOffer.source === 'boss' && onboardingPhase === 'inventory_unlocked';

            if (shouldTriggerCardsUnlockTutorial) {
                setOnboardingPhase('cards_prompt');
            }

      setPlayer(nextPlayer);
      if (levelsGained > 0) {
          showLevelUpModal(levelsGained, nextPlayer.level);
      }
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
      setPlayer((prev) => ({
          ...prev,
          stats: {
              ...prev.stats,
              hp: prev.stats.maxHp,
              mp: prev.stats.maxMp,
          },
          isDefending: false,
          isDefendendo: false,
          tipoDefesaAtiva: null,
          buffs: createEmptyBuffState(),
          statusEffects: [],
      }));
      setBossVictoryContext(null);
      setPostCardFlow(null);
      setDungeonResult(null);
      setPendingDungeonQueue([]);
      setNarration('Voce retornou da dungeon totalmente recuperado.');
      setGameState(GameState.TAVERN);
  };

  const buyItem = (item: Item, quantity = 1) => {
      const safeQuantity = Math.max(1, Math.floor(quantity));
      setPlayer((p) => buyItemForPlayer(p, item, safeQuantity));
      if (hasUnlockedMusic) {
          uiSfx.play('shop_sold');
      }
  };

  const buyAlchemistCard = (offer: AlchemistCardOffer) => {
      if (player.diamonds < offer.cost || player.level < offer.card.minLevel || player.chosenCards.includes(offer.card.id)) {
          return;
      }

      let levelsGained = 0;
      let nextLevelAfterPurchase = player.level;
      setPlayer(prev => {
          if (prev.diamonds < offer.cost || prev.level < offer.card.minLevel || prev.chosenCards.includes(offer.card.id)) {
              return prev;
          }

          const afterCard = applyCardChoice(prev, offer.card);
          afterCard.diamonds -= offer.cost;

          const leveledPlayer = applyLevelProgression(afterCard);
          levelsGained = leveledPlayer.levelsGained;
          nextLevelAfterPurchase = leveledPlayer.nextPlayer.level;
          return leveledPlayer.nextPlayer;
      });

      if (levelsGained > 0) {
          triggerLevelUpPulse(offer.card.category);
          showLevelUpModal(levelsGained, nextLevelAfterPurchase);
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

  // ── Admin panel handlers ─────────────────────────────────────────────────
  const handleAdminSetLevel = useCallback((targetLevel: number) => {
    const safeLevel = Math.max(1, Math.min(99, Math.floor(targetLevel)));
    setPlayer(prev => {
      const next = { ...prev, stats: { ...prev.stats } };
      next.level = safeLevel;
      next.xp = 0;
      next.xpToNext = getXpToNextByLevel(safeLevel);
      next.talentPoints = Math.max(prev.talentPoints, 0);
      const maxImpulse = getImpulseCapacityByLevel(safeLevel);
      next.impulso = Math.min(prev.impulso, maxImpulse);
      next.impulsoAtivo = Math.min(prev.impulsoAtivo, maxImpulse);
      // Full HP/MP restore on level set
      next.stats.hp = next.stats.maxHp;
      next.stats.mp = next.stats.maxMp;
      return next;
    });
  }, []);

  const handleAdminForceEquip = useCallback((item: Item) => {
    setPlayer(prev => {
      // Ensure item is in inventory before equipping
      const newInventory = { ...prev.inventory, [item.id]: Math.max(1, prev.inventory[item.id] ?? 0) };
      return { ...prev, inventory: newInventory };
    });
    // Use a tiny delay so state settles, then call equipItem
    window.setTimeout(() => {
      setPlayer(prev => {
        const withItem = { ...prev, inventory: { ...prev.inventory, [item.id]: Math.max(1, prev.inventory[item.id] ?? 0) } };
        // inline equip logic (slot-based)
        let next: Player = { ...withItem, stats: { ...withItem.stats } };
        if (item.type === 'weapon') next = { ...next, equippedWeapon: item };
        else if (item.type === 'armor') next = { ...next, equippedArmor: item };
        else if (item.type === 'helmet') next = { ...next, equippedHelmet: item };
        else if (item.type === 'legs') next = { ...next, equippedLegs: item };
        else if (item.type === 'shield') next = { ...next, equippedShield: item };
        // Recalculate stats
        const bonuses = applyEquipmentBonusesToStats(
          next.stats,
          next.equippedWeapon ?? null,
          next.equippedArmor ?? null,
          next.equippedHelmet ?? null,
          next.equippedLegs ?? null,
          next.equippedShield ?? null,
        );
        next.stats = { ...next.stats, ...bonuses };
        next.stats.hp = Math.min(next.stats.hp, next.stats.maxHp);
        next.stats.mp = Math.min(next.stats.mp, next.stats.maxMp);
        return next;
      });
    }, 0);
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const equipItem = (item: Item) => {
      if (gameState === GameState.BATTLE) {
          addLog('Durante a batalha voce nao pode trocar equipamento. Abra a mochila apenas para consultar.', 'info');
          return;
      }

      const currentlyEquipped = (
          item.type === 'weapon' ? player.equippedWeapon
          : item.type === 'armor' ? player.equippedArmor
          : item.type === 'helmet' ? player.equippedHelmet
          : item.type === 'legs' ? player.equippedLegs
          : item.type === 'shield' ? player.equippedShield
          : null
      );
      if (currentlyEquipped?.id === item.id) {
          return;
      }

      setPlayer(p => {
          const normalizedInventory = { ...p.inventory };
          const ensureEquippedVisible = (equipped: Item | null) => {
              if (!equipped) return;
              if ((normalizedInventory[equipped.id] || 0) <= 0) {
                  normalizedInventory[equipped.id] = 1;
              }
          };

          ensureEquippedVisible(p.equippedWeapon);
          ensureEquippedVisible(p.equippedArmor);
          ensureEquippedVisible(p.equippedHelmet);
          ensureEquippedVisible(p.equippedLegs);
          ensureEquippedVisible(p.equippedShield);

          const qty = normalizedInventory[item.id];
          if (!qty || qty <= 0) return p;

          // Equip keeps the item visible in inventory.
          let newStats = { ...p.stats };
          let newWep = p.equippedWeapon;
          let newArm = p.equippedArmor;
          let newHelm = p.equippedHelmet;
          let newLegs = p.equippedLegs;
          let newShield = p.equippedShield;

          if (item.type === 'weapon') {
              const previousProficiencyBonuses = getWeaponProficiencyAppliedBonuses(p.classId, newWep);
              if (hasWeaponProficiencyBonuses(previousProficiencyBonuses)) {
                  newStats = applyWeaponProficiencyBonusesToStats(newStats, previousProficiencyBonuses, -1);
              }

              newStats = applyEquipmentBonusesToStats(newStats, newWep, -1);
              newStats = applyEquipmentBonusesToStats(newStats, item, 1);

              const nextProficiencyBonuses = getWeaponProficiencyAppliedBonuses(p.classId, item);
              if (hasWeaponProficiencyBonuses(nextProficiencyBonuses)) {
                  newStats = applyWeaponProficiencyBonusesToStats(newStats, nextProficiencyBonuses, 1);
              }

              newWep = item;
          }
          if (item.type === 'armor') {
              newStats = applyEquipmentBonusesToStats(newStats, newArm, -1);
              newStats = applyEquipmentBonusesToStats(newStats, item, 1);
              newArm = item;
          }
          if (item.type === 'helmet') {
              newStats = applyEquipmentBonusesToStats(newStats, newHelm, -1);
              newStats = applyEquipmentBonusesToStats(newStats, item, 1);
              newHelm = item;
          }
          if (item.type === 'legs') {
              newStats = applyEquipmentBonusesToStats(newStats, newLegs, -1);
              newStats = applyEquipmentBonusesToStats(newStats, item, 1);
              newLegs = item;
          }
          if (item.type === 'shield') {
              newStats = applyEquipmentBonusesToStats(newStats, newShield, -1);
              newStats = applyEquipmentBonusesToStats(newStats, item, 1);
              newShield = item;
          }

          return { 
              ...p, 
              stats: newStats,
              inventory: normalizedInventory,
              equippedWeapon: newWep,
              equippedArmor: newArm,
              equippedHelmet: newHelm,
              equippedLegs: newLegs,
              equippedShield: newShield
          };
      });

      if (hasUnlockedMusic) {
          uiSfx.play('item_equip');
      }
  };

  const unequipItem = (item: Item) => {
      if (gameState === GameState.BATTLE) {
          addLog('Durante a batalha voce nao pode trocar equipamento. Abra a mochila apenas para consultar.', 'info');
          return;
      }

      const isEquipped = (
          (item.type === 'weapon' && player.equippedWeapon?.id === item.id)
          || (item.type === 'armor' && player.equippedArmor?.id === item.id)
          || (item.type === 'helmet' && player.equippedHelmet?.id === item.id)
          || (item.type === 'legs' && player.equippedLegs?.id === item.id)
          || (item.type === 'shield' && player.equippedShield?.id === item.id)
      );
      if (!isEquipped) {
          return;
      }

      setPlayer((p) => {
          let newStats = { ...p.stats };
          let newWep = p.equippedWeapon;
          let newArm = p.equippedArmor;
          let newHelm = p.equippedHelmet;
          let newLegs = p.equippedLegs;
          let newShield = p.equippedShield;

          if (item.type === 'weapon' && newWep?.id === item.id) {
              const proficiencyBonuses = getWeaponProficiencyAppliedBonuses(p.classId, item);
              if (hasWeaponProficiencyBonuses(proficiencyBonuses)) {
                  newStats = applyWeaponProficiencyBonusesToStats(newStats, proficiencyBonuses, -1);
              }

              newStats = applyEquipmentBonusesToStats(newStats, item, -1);
              newWep = null;
          }
          if (item.type === 'armor' && newArm?.id === item.id) {
              newStats = applyEquipmentBonusesToStats(newStats, item, -1);
              newArm = null;
          }
          if (item.type === 'helmet' && newHelm?.id === item.id) {
              newStats = applyEquipmentBonusesToStats(newStats, item, -1);
              newHelm = null;
          }
          if (item.type === 'legs' && newLegs?.id === item.id) {
              newStats = applyEquipmentBonusesToStats(newStats, item, -1);
              newLegs = null;
          }
          if (item.type === 'shield' && newShield?.id === item.id) {
              newStats = applyEquipmentBonusesToStats(newStats, item, -1);
              newShield = null;
          }

          return {
              ...p,
              stats: newStats,
              equippedWeapon: newWep,
              equippedArmor: newArm,
              equippedHelmet: newHelm,
              equippedLegs: newLegs,
              equippedShield: newShield,
          };
      });

      if (hasUnlockedMusic) {
          uiSfx.play('item_equip_off');
      }
  };

  const equipSkillToSlot = (slotIndex: number, skillId: string | null) => {
      setPlayer((p) => {
          const maxSkills = getClassSlots(p.classId).skills;
          const ids = [...(p.equippedSkillIds ?? [])];
          while (ids.length < maxSkills) ids.push('');
          // Remove from any other slot first (each skill can only occupy one slot)
          const newId = skillId ?? '';
          if (newId) {
              for (let i = 0; i < ids.length; i++) {
                  if (ids[i] === newId && i !== slotIndex) ids[i] = '';
              }
          }
          ids[slotIndex] = newId;
          return { ...p, equippedSkillIds: ids };
      });
  };

  const equipItemToSlot = (slotIndex: number, itemId: string | null) => {
      setPlayer((p) => {
          const maxItems = getClassSlots(p.classId).items;
          const slots = (p.equippedItemSlots ?? []).map(s => ({ ...s }));
          while (slots.length < maxItems) slots.push({ itemId: '', qty: 0 });
          const newInv = { ...p.inventory };

          // Return existing slot item to inventory
          const existing = slots[slotIndex];
          if (existing.itemId && existing.qty > 0) {
              newInv[existing.itemId] = (newInv[existing.itemId] ?? 0) + existing.qty;
          }

          if (!itemId) {
              slots[slotIndex] = { itemId: '', qty: 0 };
          } else {
              // Each slot independently draws up to 5x of the item from inventory.
              // The same item can appear in multiple slots simultaneously.
              const available = newInv[itemId] ?? 0;
              const transfer = Math.min(available, 5);
              newInv[itemId] = available - transfer;
              slots[slotIndex] = { itemId, qty: transfer };
          }

          return { ...p, inventory: newInv, equippedItemSlots: slots };
      });
      if (hasUnlockedMusic) {
          uiSfx.play('item_equip_off');
      }
  };

  const sellItem = (item: Item, quantity = 1) => {
      const safeQuantity = Math.max(1, Math.floor(quantity));
      setPlayer((p) => sellItemFromPlayer(p, item, safeQuantity));
      if (hasUnlockedMusic) {
          uiSfx.play('shop_sell');
      }
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
    const isDefenseAnimationActive = player.isDefending || player.buffs.autoGuardTurns > 0;
    const activeDungeonPhase = getDungeonPhaseFromEvolution(dungeonRun?.evolution ?? dungeonEvolution);
    const alchemistCardOffers = useMemo(
        () => ALCHEMIST_CARDS.filter((offer) => !player.chosenCards.includes(offer.card.id)),
        [player.chosenCards]
    );
    const isCampIntroRestricted = onboardingPhase === 'intro_camp'
        || onboardingPhase === 'post_first_hunt'
        || onboardingPhase === 'inventory_prompt'
        || onboardingPhase === 'inventory_unlocked'
        || onboardingPhase === 'cards_prompt'
        || onboardingPhase === 'cards_unlocked'
        || onboardingPhase === 'merchant_prompt'
        || onboardingPhase === 'dungeon_prompt'
        || onboardingPhase === 'alchemist_prompt';
    const isProfileStatusOnly = true;
    const isFirstBattleActionRestricted = false;
    const isInventoryUnlocked = onboardingPhase === 'inventory_unlocked' || onboardingPhase === 'missions_prompt' || onboardingPhase === 'missions_unlocked' || onboardingPhase === 'cards_prompt' || onboardingPhase === 'cards_unlocked' || onboardingPhase === 'merchant_prompt' || onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isMissionsUnlocked = ONBOARDING_PHASES.indexOf(onboardingPhase) >= ONBOARDING_PHASES.indexOf('missions_unlocked');
    const isCardsUnlocked = onboardingPhase === 'cards_prompt' || onboardingPhase === 'cards_unlocked' || onboardingPhase === 'merchant_prompt' || onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isItemsActionUnlocked = onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isFleeUnlocked = onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isSkillsActionUnlocked = skillsActionUnlocked;
    // ── Battle actions config (passed to GameScene → BattleActionsHtml via Html3D) ────────
    const _battleImpulseCapacity = getImpulseCapacityByLevel(player.level);
    const _battleClassImpulseColor = getPlayerClassById(player.classId).visualProfile.auraColor ?? '#f59e0b';
    const battleActionsConfig: BattleActionsConfig = {
      isPlayerTurn: turnState === TurnState.PLAYER_INPUT,
      showSkillsAction: isSkillsActionUnlocked,
      showItemsAction: isItemsActionUnlocked,
      impulseUnlocked: _battleImpulseCapacity > 0,
      impulseCapacity: _battleImpulseCapacity,
      impulseReserveColors: [_battleClassImpulseColor, _battleClassImpulseColor, _battleClassImpulseColor],
      classImpulseBaseColor: _battleClassImpulseColor,
      absorbGlowColor: player.impulsoAtivo >= 3 ? '#3b82f6' : player.impulsoAtivo === 2 ? '#a855f7' : '#ef4444',
      usesMagicBasicAttack: shouldUseMagicBasicAttack(player.classId, player.equippedWeapon),
      usesBowBasicAttack: shouldUseBowBasicAttack(player.classId, player.equippedWeapon),
      limitBattleActionsToBasics: isFirstBattleActionRestricted,
      shopItems: ALL_ITEMS,
      onAttack: handleAttackWithTargetCheck,
    onDefend: handlePlayerDefenseWithTimeline,
    onChargeImpulse: handleChargeImpulseWithTimeline,
      onAbsorbImpulse: handleAbsorbImpulse,
      onSkill: handleSkillWithTargetCheck,
    onUseItem: handleUseItemWithTimeline,
      showFleeAction: isFleeUnlocked && !dungeonRun && !(enemy?.isBoss) && killCount < 10,
      onFlee: handleFlee,
    };
    const isMerchantUnlocked = onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isDungeonUnlocked = onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isAlchemistUnlocked = onboardingPhase === 'alchemist_unlocked';

    // Memoize the XP icon component — avoids a full IconMap lookup + JSX element allocation
    // on every render of App (which is very frequent during battle).
    const xpIconComponent = useMemo(() => {
        const IconMap: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = { knight: Shield, barbarian: Sword, mage: Sparkles, ranger: Crosshair, rogue: Zap };
        const ClassIcon = IconMap[player.classId] ?? Zap;
        return <ClassIcon size={20} color="#d97706" strokeWidth={2.5} />;
    }, [player.classId]);
    const [cameraSceneAnchor, setCameraSceneAnchor] = useState<'camp' | 'battle'>(() => (
        resolvedGameState === GameState.BATTLE ? 'battle' : 'camp'
    ));
    const shouldMenuCameraFocus = menuCameraFocusOverride ?? (cameraSceneAnchor === 'camp');
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
        if (resolvedGameState !== GameState.TAVERN || dungeonRun || stage < 4) {
            return;
        }

        setOnboardingPhase((prev) => {
            if (prev === 'dungeon_prompt' || prev === 'dungeon_unlocked') {
                return prev;
            }

            if (prev !== 'flee_unlocked') {
                return prev;
            }

            return 'dungeon_prompt';
        });
    }, [dungeonRun, resolvedGameState, stage]);

    useEffect(() => {
        if (resolvedGameState !== GameState.TAVERN || dungeonRun || dungeonEvolution < 1) {
            return;
        }

        setOnboardingPhase((prev) => {
            if (prev === 'alchemist_prompt' || prev === 'alchemist_unlocked') {
                return prev;
            }

            if (prev !== 'dungeon_unlocked') {
                return prev;
            }

            return 'alchemist_prompt';
        });
    }, [dungeonEvolution, dungeonRun, resolvedGameState]);

    useEffect(() => {
        if (resolvedGameState === GameState.BATTLE) {
            setCameraSceneAnchor('battle');
            return;
        }

        if (resolvedGameState === GameState.TAVERN) {
            setCameraSceneAnchor('camp');
        }
    }, [resolvedGameState]);

    useEffect(() => {
        if (resolvedGameState !== GameState.TAVERN) {
            if (menuHeroActionResetTimerRef.current !== null) {
                window.clearTimeout(menuHeroActionResetTimerRef.current);
                menuHeroActionResetTimerRef.current = null;
            }
            setMenuHeroAction('idle');
            return;
        }

        setMenuHeroAction('idle');
    }, [resolvedGameState]);

    const [battleSettings, setBattleSettings] = useState<BattleSettings>(() => readBattleSettings());
    const [hasUnlockedMusic, setHasUnlockedMusic] = useState(false);
    const recommendedRenderQualityPreset = useMemo(() => getDefaultRenderQualityPreset(), []);
    const updateBattleSettings = useCallback((partial: Partial<BattleSettings>) => {
        setBattleSettings((prev) => ({
            ...prev,
            ...partial,
        }));
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(BATTLE_SETTINGS_STORAGE_KEY, JSON.stringify(battleSettings));
    }, [battleSettings]);

    useEffect(() => {
        gameMusicManager.setEnabled(battleSettings.musicEnabled);
        if (!battleSettings.musicEnabled) {
            gameMusicManager.stopAll(220);
        }
    }, [battleSettings.musicEnabled]);

    useEffect(() => {
        battleSfx.setEnabled(battleSettings.sfxEnabled);
        uiSfx.setEnabled(battleSettings.sfxEnabled);
    }, [battleSettings.sfxEnabled]);

    const targetMusicTrack = useMemo<MusicTrackId | null>(() => {
        if (pathname.startsWith('/developer')) {
            return null;
        }

        const campAndSelectionTrack: MusicTrackId = 'title';
        const isInitialMenuFlow = !hasConfirmedStartingClass || resolvedGameState === GameState.MENU;

        if (!isBootReady || isInitialMenuFlow) {
            return campAndSelectionTrack;
        }

        if (dungeonRun) {
            return 'dungeon';
        }

        if (resolvedGameState === GameState.BATTLE) {
            return 'huntBattle';
        }

        return sceneRegion === 'dungeon' ? 'dungeon' : campAndSelectionTrack;
    }, [dungeonRun, gameTime, hasConfirmedStartingClass, isBootReady, pathname, resolvedGameState, sceneRegion]);

    const isAudioUnlockingRef = useRef(false);
    useEffect(() => {
        if (typeof window === 'undefined' || hasUnlockedMusic) {
            return;
        }

        const unlockMusic = () => {
            if (isAudioUnlockingRef.current || hasUnlockedMusic) {
                return;
            }
            isAudioUnlockingRef.current = true;

            const tryUnlock = async () => {
                try {
                    const unlockResults = await Promise.allSettled([gameMusicManager.unlock(), battleSfx.unlock(), uiSfx.unlock()]);
                    const isContextReady = unlockResults.some((result) => result.status === 'fulfilled' && result.value);
                    battleSfx.preload();
                    uiSfx.preload();

                    // Keep recovery hooks active after first gesture even if resume fails on this exact event.
                    setHasUnlockedMusic(true);

                    if (!isContextReady) {
                        console.warn('[Audio] Contexto ainda bloqueado; aguardando nova interacao do usuario.');
                    }

                    if (targetMusicTrack && battleSettings.musicEnabled) {
                        // iOS exige uma tentativa de play imediatamente apos o gesto para liberar BGM no PWA.
                        gameMusicManager.transitionTo(targetMusicTrack, 0);
                    }
                } catch (error) {
                    setHasUnlockedMusic(true);
                    console.warn('[Audio] Falha ao desbloquear audio; nova tentativa sera feita na proxima interacao.', error);
                } finally {
                    isAudioUnlockingRef.current = false;
                }
            };

            void tryUnlock();
        };

        const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
        window.addEventListener('pointerdown', unlockMusic, listenerOptions);
        window.addEventListener('touchstart', unlockMusic, listenerOptions);
        window.addEventListener('touchend', unlockMusic, listenerOptions);
        window.addEventListener('mousedown', unlockMusic, listenerOptions);
        window.addEventListener('click', unlockMusic, listenerOptions);
        window.addEventListener('pointerup', unlockMusic, listenerOptions);
        window.addEventListener('keydown', unlockMusic, { capture: true });

        return () => {
            window.removeEventListener('pointerdown', unlockMusic, listenerOptions);
            window.removeEventListener('touchstart', unlockMusic, listenerOptions);
            window.removeEventListener('touchend', unlockMusic, listenerOptions);
            window.removeEventListener('mousedown', unlockMusic, listenerOptions);
            window.removeEventListener('click', unlockMusic, listenerOptions);
            window.removeEventListener('pointerup', unlockMusic, listenerOptions);
            window.removeEventListener('keydown', unlockMusic, { capture: true });
        };
    }, [battleSettings.musicEnabled, hasUnlockedMusic, targetMusicTrack]);

    useEffect(() => {
        if (!hasUnlockedMusic) {
            return;
        }

        if (!battleSettings.musicEnabled || !targetMusicTrack) {
            gameMusicManager.stopAll();
            return;
        }

        gameMusicManager.transitionTo(targetMusicTrack);
    }, [battleSettings.musicEnabled, hasUnlockedMusic, targetMusicTrack]);

    useEffect(() => {
        if (!hasUnlockedMusic || typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        const isLikelyIos = /iPad|iPhone|iPod/i.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const recoveryDelays = isLikelyIos ? [0, 180, 620] : [0];
        const pendingRecoveryTimers = new Set<number>();
        const isGestureEvent = (event?: Event) => ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'].includes(event?.type ?? '');

        const recoverAudio = (event?: Event) => {
            if (document.visibilityState === 'hidden') {
                return;
            }

            const shouldAttemptUnlock = isGestureEvent(event);

            const ensureRecovered = async () => {
                if (shouldAttemptUnlock) {
                    const unlockResults = await Promise.allSettled([gameMusicManager.unlock(), battleSfx.unlock(), uiSfx.unlock()]);
                    const isContextReady = unlockResults.some((result) => result.status === 'fulfilled' && result.value);

                    if (!isContextReady) {
                        return;
                    }
                }

                if (!battleSettings.musicEnabled || !targetMusicTrack) {
                    gameMusicManager.stopAll();
                    return;
                }

                gameMusicManager.transitionTo(targetMusicTrack, 420);
            };

            recoveryDelays.forEach((delayMs) => {
                const timerId = window.setTimeout(() => {
                    pendingRecoveryTimers.delete(timerId);
                    void ensureRecovered();
                }, delayMs);
                pendingRecoveryTimers.add(timerId);
            });
        };

        const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
        window.addEventListener('focus', recoverAudio);
        window.addEventListener('pageshow', recoverAudio);
        window.addEventListener('pointerdown', recoverAudio, listenerOptions);
        window.addEventListener('touchstart', recoverAudio, listenerOptions);
        window.addEventListener('mousedown', recoverAudio, listenerOptions);
        window.addEventListener('click', recoverAudio, listenerOptions);
        window.addEventListener('keydown', recoverAudio, { capture: true });
        document.addEventListener('visibilitychange', recoverAudio);

        return () => {
            window.removeEventListener('focus', recoverAudio);
            window.removeEventListener('pageshow', recoverAudio);
            window.removeEventListener('pointerdown', recoverAudio, listenerOptions);
            window.removeEventListener('touchstart', recoverAudio, listenerOptions);
            window.removeEventListener('mousedown', recoverAudio, listenerOptions);
            window.removeEventListener('click', recoverAudio, listenerOptions);
            window.removeEventListener('keydown', recoverAudio, { capture: true });
            document.removeEventListener('visibilitychange', recoverAudio);
            pendingRecoveryTimers.forEach((timerId) => {
                window.clearTimeout(timerId);
            });
            pendingRecoveryTimers.clear();
        };
    }, [battleSettings.musicEnabled, hasUnlockedMusic, targetMusicTrack]);

    useEffect(() => () => {
        gameMusicManager.dispose();
        battleSfx.dispose();
        uiSfx.dispose();
    }, []);

    useEffect(() => {
        const closeKeywords = ['fechar', 'cancelar', 'voltar', 'sair', 'close', 'cancel'];
        const clickableRoles = new Set(['button', 'link', 'menuitem', 'tab', 'switch', 'checkbox', 'radio', 'option']);

        const normalize = (value: string) => value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        const isLikelyClickable = (element: HTMLElement) => {
            const tagName = element.tagName;
            if (tagName === 'BUTTON' || tagName === 'A') return true;
            if (tagName === 'INPUT') {
                const type = (element as HTMLInputElement).type;
                return type === 'button' || type === 'submit' || type === 'reset';
            }

            const role = normalize(element.getAttribute('role') ?? '');
            if (clickableRoles.has(role)) return true;

            if (element.classList.contains('cursor-pointer')) return true;
            if (element.getAttribute('tabindex') !== null && Number(element.getAttribute('tabindex')) >= 0) return true;

            return false;
        };

        const shouldPlayOut = (element: HTMLElement) => {
            if (element.dataset.uiClickOut === 'true') {
                return true;
            }

            const roleLabel = [
                element.getAttribute('aria-label') ?? '',
                element.getAttribute('title') ?? '',
                element.textContent ?? '',
            ].map(normalize).join(' ');

            return closeKeywords.some((keyword) => roleLabel.includes(keyword));
        };

        const handleUiClick = (event: MouseEvent) => {
            if (!hasUnlockedMusic) {
                return;
            }

            const target = event.target as HTMLElement | null;
            if (!target) return;

            const clickable = target.closest('button, a, input, [role], .cursor-pointer, [tabindex]') as HTMLElement | null;
            if (!clickable || !isLikelyClickable(clickable)) return;

            uiSfx.play(shouldPlayOut(clickable) ? 'click_out' : 'click_in');
        };

        window.addEventListener('click', handleUiClick, { capture: true });
        return () => {
            window.removeEventListener('click', handleUiClick, { capture: true });
        };
    }, [battleSettings.sfxEnabled, hasUnlockedMusic]);

    const wasNewMechanicModalOpenRef = useRef(false);
    useEffect(() => {
        if (!hasUnlockedMusic) {
            wasNewMechanicModalOpenRef.current = false;
            return;
        }

        const isNewMechanicModalOpen = (
            onboardingPhase === 'inventory_prompt'
            || onboardingPhase === 'cards_prompt'
            || onboardingPhase === 'merchant_prompt'
            || onboardingPhase === 'items_prompt'
            || onboardingPhase === 'flee_prompt'
            || onboardingPhase === 'alchemist_prompt'
            || skillsUnlockPromptPending
            || constellationUnlockPromptPending
            || constellationRespecUnlockPromptPending
            || Boolean(resourceUnlockModal)
        );

        if (isNewMechanicModalOpen && !wasNewMechanicModalOpenRef.current) {
            uiSfx.play('new_mechanic_modal');
        }

        wasNewMechanicModalOpenRef.current = isNewMechanicModalOpen;
    }, [
        constellationRespecUnlockPromptPending,
        constellationUnlockPromptPending,
        hasUnlockedMusic,
        onboardingPhase,
        resourceUnlockModal,
        skillsUnlockPromptPending,
    ]);

    const hasAnySaveSlot = saveSlots.some((slot) => slot.hasSave);
    const existingSaveSlots = saveSlots.filter((slot) => slot.hasSave);
    const selectedSlotSummary = saveSlots.find((slot) => slot.slotId === selectedSaveSlotId && slot.hasSave) ?? existingSaveSlots[0] ?? null;
    const canContinueSelectedSlot = Boolean(selectedSlotSummary?.hasSave);
    const firstAvailableEmptySlotId = saveSlots.find((slot) => !slot.hasSave)?.slotId ?? null;
    const canCreateNewSaveSlot = firstAvailableEmptySlotId !== null;

    if (pathname.startsWith('/developer')) {
        return (
            <div className="absolute inset-0 overflow-y-auto" data-scrollable>
                <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-semibold text-slate-200">Carregando ferramentas de desenvolvimento...</div>}>
                    <DeveloperConsole />
                </Suspense>
            </div>
        );
    }

    if (!isBootReady) {
        return (
            <>
            <div className="w-full h-screen bg-black overflow-hidden select-none">
                <OpeningScreen classes={PLAYER_CLASSES} enemies={bootEnemies} onReady={handleBootReady} />
            </div>
            <GamepadHint />
            <GamepadIndicator />
            <GamepadActionLegend />
            </>
        );
    }

    if (!hasConfirmedStartingClass) {
        if (!isSaveSlotCatalogReady) {
            return (
                <>
                <div className="relative w-full h-screen overflow-hidden select-none hero-brand-root">
                    <div className="hero-brand-background" style={{ backgroundImage: `url(${MENU_BACKGROUND_IMAGE_URL})` }} />
                    <div className="hero-brand-vignette" />
                    <div className="hero-brand-noise" />

                    <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
                        <img
                            src={MENU_LOGO_IMAGE_URL}
                            alt="Hero Tower"
                            className="w-full max-w-[300px] sm:max-w-[380px] hero-brand-logo-shadow hero-brand-logo-intro"
                            draggable={false}
                        />
                        <div className="mt-6 rounded-[18px] border border-[#f8e6cc]/45 bg-[#2d1c18]/52 px-5 py-4 shadow-[0_20px_42px_rgba(16,8,8,0.36)]">
                            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f9d5a8]">Sincronizando</div>
                            <div className="mt-2 font-gamer text-xl font-black text-[#fff7ea] sm:text-2xl">Lendo save data local</div>
                        </div>
                    </div>
                </div>
                <GamepadHint />
                <GamepadIndicator />
                <GamepadActionLegend />
                </>
            );
        }

        if (!hasSavePromptDecision) {
            return (
                <>
                <div className="relative w-full h-screen overflow-hidden select-none hero-brand-root">
                    <div className="hero-brand-background" style={{ backgroundImage: `url(${MENU_BACKGROUND_IMAGE_URL})` }} />
                    <div className="hero-brand-vignette" />
                    <div className="hero-brand-noise" />

                    <div className="relative z-10 flex h-full flex-col px-4 pt-5 sm:px-8 sm:pt-8" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
                        <div className="mx-auto w-full max-w-5xl text-center animate-fade-in-down">
                            <img
                                src={MENU_LOGO_IMAGE_URL}
                                alt="Hero Tower"
                                className="mx-auto w-full max-w-[290px] sm:max-w-[390px] hero-brand-logo-shadow hero-brand-logo-intro"
                                draggable={false}
                            />
                        </div>

                        <div className="mx-auto mt-auto w-full max-w-5xl rounded-[26px] border border-[#f8dfbd]/36 bg-[#1f1210]/58 p-3 backdrop-blur-[1.5px] sm:p-5 shadow-[0_22px_64px_rgba(9,5,5,0.42)]">
                            <div className="px-2 pb-1">
                                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f8d3a8]">Menu inicial</div>
                                <h2 className="mt-1 font-gamer text-xl font-black text-[#fff3df] sm:text-2xl">Escolha um save</h2>
                            </div>

                            {hasAnySaveSlot ? (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {existingSaveSlots.map((slot, index) => {
                                        const slotClassDef = slot.classId ? getPlayerClassById(slot.classId as PlayerClassId) : null;
                                        const SlotClassIcon = (slot.classId ? SAVE_CLASS_ICON[slot.classId] : null) ?? Shield;
                                        const slotSceneThumb = SAVE_SCENE_THUMBNAIL[slot.sceneRegion ?? 'forest'] ?? SAVE_THUMB_MOUNTAIN_URL;
                                        const accentColor = slotClassDef?.visualProfile.secondaryColor ?? '#b87a3a';
                                        const auraColor = slotClassDef?.visualProfile.auraColor ?? '#f8c77e';
                                        const slotClassLabel = (slot.classId ? SAVE_CLASS_NAME_PT[slot.classId] : null) ?? slotClassDef?.name ?? slot.classId ?? 'Sem classe';
                                        const slotHeroAvatarUrl = slotClassDef?.avatars.faceSquare.url ?? null;
                                        const isGpFocused = saveMenuFocusIdx === index;
                                        return (
                                            <button
                                                key={slot.slotId}
                                                onClick={() => {
                                                    setPendingContinueSlot(slot);
                                                    setSelectedSaveSlotId(slot.slotId);
                                                    setActiveSaveSlotId(slot.slotId);
                                                    setShowSlotContinueModal(true);
                                                    requestAnimationFrame(() => setSlotContinueModalVisible(true));
                                                }}
                                                className="hero-save-card relative min-h-[148px] overflow-hidden text-left sm:min-h-[164px]"
                                                style={{
                                                    animationDelay: `${index * 55}ms`,
                                                    boxShadow: isGpFocused
                                                        ? `0 0 0 2px ${accentColor}, 0 0 18px ${accentColor}88, 0 14px 30px rgba(0,0,0,0.33)`
                                                        : `0 0 0 1px ${accentColor}44, 0 14px 30px rgba(0,0,0,0.33)`,
                                                    transform: isGpFocused ? 'scale(1.03)' : undefined,
                                                    transition: 'box-shadow 150ms, transform 150ms',
                                                }}
                                            >
                                                {/* Scenario thumbnail background */}
                                                <div className="absolute inset-0 pointer-events-none" aria-hidden>
                                                    <img
                                                        src={slotSceneThumb}
                                                        alt=""
                                                        className="w-full h-full scale-[1.05] object-cover opacity-55"
                                                        style={{ filter: 'saturate(1.18) contrast(1.05)' }}
                                                        draggable={false}
                                                    />
                                                    <div className="absolute inset-0" style={{ background: `linear-gradient(115deg, ${accentColor}55 0%, rgba(20,10,8,0.18) 28%, rgba(20,10,8,0.8) 68%, rgba(10,5,4,0.94) 100%)` }} />
                                                    <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 82% 22%, ${auraColor}40 0%, rgba(255,255,255,0.1) 14%, transparent 36%)` }} />
                                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,4,4,0.02) 0%, rgba(8,4,4,0.08) 34%, rgba(8,4,4,0.34) 58%, rgba(8,4,4,0.88) 100%)' }} />
                                                    <div className="absolute -right-6 top-3 h-20 w-20 rounded-full blur-2xl" style={{ backgroundColor: `${auraColor}44` }} />
                                                </div>

                                                {/* Class color left stripe */}
                                                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[1rem]" style={{ backgroundColor: accentColor }} />

                                                <div className="relative flex h-full flex-col justify-between gap-4 pl-2">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f8dcb7] drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">Slot {slot.slotId}</div>
                                                            <div className="mt-2 flex items-end gap-2">
                                                                <div className="text-[1.55rem] font-black leading-none text-[#fff6e8] drop-shadow-[0_3px_8px_rgba(0,0,0,0.5)] sm:text-[1.75rem]">Nivel {slot.level ?? 1}</div>
                                                                <div className="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.24em] text-[#fff4df]"
                                                                    style={{
                                                                        borderColor: `${accentColor}66`,
                                                                        background: 'rgba(22, 12, 10, 0.58)',
                                                                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 14px ${accentColor}22`,
                                                                    }}
                                                                >
                                                                    Save
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!slotHeroAvatarUrl && (
                                                            <div className="flex items-center justify-center h-10 w-10 rounded-[0.95rem] border shrink-0"
                                                                style={{
                                                                    backgroundColor: 'rgba(18, 10, 9, 0.76)',
                                                                    borderColor: `${accentColor}88`,
                                                                    color: auraColor,
                                                                    boxShadow: `0 10px 22px rgba(0,0,0,0.36), inset 0 0 0 1px ${auraColor}33`,
                                                                }}
                                                            >
                                                                <SlotClassIcon size={16} />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-end justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div
                                                                className="inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#fff4df]"
                                                                style={{
                                                                    borderColor: `${accentColor}88`,
                                                                    background: 'linear-gradient(180deg, rgba(23,12,10,0.84) 0%, rgba(12,6,6,0.82) 100%)',
                                                                    boxShadow: `0 10px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)`,
                                                                }}
                                                            >
                                                                <span className="truncate">{slotClassLabel}</span>
                                                            </div>
                                                            <div className="mt-2 text-xs text-[#f8dbc0]/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.42)]">{formatSaveDate(slot.savedAt)}</div>
                                                        </div>

                                                        {slotHeroAvatarUrl && (
                                                            <div className="relative shrink-0 overflow-visible">
                                                                <div
                                                                    className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl sm:h-24 sm:w-24"
                                                                    style={{
                                                                        background: `radial-gradient(circle, ${auraColor}4a 0%, ${accentColor}30 42%, rgba(0,0,0,0) 74%)`,
                                                                    }}
                                                                />
                                                                <div
                                                                    className="relative h-16 w-16 overflow-hidden rounded-[1rem] border sm:h-20 sm:w-20"
                                                                    style={{
                                                                        borderColor: `${accentColor}aa`,
                                                                        background: 'linear-gradient(180deg, rgba(20,11,10,0.96) 0%, rgba(10,5,5,0.9) 100%)',
                                                                        boxShadow: `0 12px 24px rgba(0,0,0,0.45), inset 0 0 0 1px ${auraColor}33`,
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={slotHeroAvatarUrl}
                                                                        alt={`Avatar de ${slotClassLabel}`}
                                                                        className="h-full w-full scale-[1.08] object-cover object-center"
                                                                        draggable={false}
                                                                    />
                                                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, transparent 35%, rgba(10,5,5,0.3) 70%, rgba(10,5,5,0.68) 100%)' }} />
                                                                </div>
                                                                <div
                                                                    className="absolute -bottom-2 -right-1 flex h-8 w-8 items-center justify-center rounded-[0.95rem] border"
                                                                    style={{
                                                                        background: 'linear-gradient(180deg, rgba(22,11,10,0.98) 0%, rgba(11,5,5,0.96) 100%)',
                                                                        borderColor: `${accentColor}aa`,
                                                                        color: auraColor,
                                                                        boxShadow: `0 8px 18px rgba(0,0,0,0.4), inset 0 0 0 1px ${auraColor}22`,
                                                                    }}
                                                                >
                                                                    <SlotClassIcon size={14} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-[18px] border border-[#f7d2a5]/32 bg-[#2a1815]/56 px-4 py-4 text-center text-sm text-[#f8dcc0]">
                                    Nenhum save criado ainda. Clique em Novo jogo para criar o primeiro slot automaticamente.
                                </div>
                            )}

                            <div className="mt-4">
                                {canCreateNewSaveSlot ? (
                                    <button
                                        onClick={handleNewGameFromSlot}
                                        className="hero-menu-action hero-menu-action-secondary w-full"
                                        style={{
                                            boxShadow: saveMenuFocusIdx === existingSaveSlots.length
                                                ? '0 0 0 2px #f8c77e, 0 0 18px #f8c77e88' : undefined,
                                            transform: saveMenuFocusIdx === existingSaveSlots.length ? 'scale(1.03)' : undefined,
                                            transition: 'box-shadow 150ms, transform 150ms',
                                        }}
                                    >
                                        <Sword size={16} className="shrink-0" /> Novo jogo
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setShowClearSaveConfirmModal(true);
                                            requestAnimationFrame(() => setClearSaveModalVisible(true));
                                        }}
                                        disabled={!canContinueSelectedSlot}
                                        className="hero-menu-action hero-menu-action-secondary w-full"
                                        style={{
                                            display: menuUiProfile === 'gamepad' ? 'none' : undefined,
                                            boxShadow: saveMenuFocusIdx === existingSaveSlots.length && !canCreateNewSaveSlot
                                                ? '0 0 0 2px #f8c77e, 0 0 18px #f8c77e88' : undefined,
                                            transform: saveMenuFocusIdx === existingSaveSlots.length && !canCreateNewSaveSlot ? 'scale(1.03)' : undefined,
                                            transition: 'box-shadow 150ms, transform 150ms',
                                        }}
                                    >
                                        Desfazer save
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Slot continue modal */}
                        {showSlotContinueModal && pendingContinueSlot && (() => {
                            const slot = pendingContinueSlot;
                            const slotClassDef = slot.classId ? getPlayerClassById(slot.classId as PlayerClassId) : null;
                            const SlotClassIcon = (slot.classId ? SAVE_CLASS_ICON[slot.classId] : null) ?? Shield;
                            const slotSceneThumb = SAVE_SCENE_THUMBNAIL[slot.sceneRegion ?? 'forest'] ?? SAVE_THUMB_MOUNTAIN_URL;
                            const accentColor = slotClassDef?.visualProfile.secondaryColor ?? '#b87a3a';
                            const auraColor = slotClassDef?.visualProfile.auraColor ?? '#f8c77e';
                            const slotClassLabel = (slot.classId ? SAVE_CLASS_NAME_PT[slot.classId] : null) ?? slotClassDef?.name ?? slot.classId ?? 'Sem classe';
                            const slotHeroAvatarUrl = slotClassDef?.avatars.faceSquare.url ?? null;
                            const closeModal = () => {
                                setSlotContinueModalVisible(false);
                                setTimeout(() => setShowSlotContinueModal(false), 260);
                            };
                            const handleModalPlay = () => {
                                closeModal();
                                handleContinueFromSave();
                                setLoadingSplash({ slot, visible: false });
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => setLoadingSplash(prev => prev ? { ...prev, visible: true } : prev));
                                });
                            };
                            // Sync refs so the gamepad onAction handler can call them
                            modalCloseRef.current   = closeModal;
                            modalConfirmRef.current = handleModalPlay;
                            return (
                                <div
                                    className="absolute inset-0 z-20 flex items-end sm:items-center justify-center px-4"
                                    style={{
                                        background: slotContinueModalVisible ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0)',
                                        backdropFilter: slotContinueModalVisible ? 'blur(10px)' : 'blur(0px)',
                                        WebkitBackdropFilter: slotContinueModalVisible ? 'blur(10px)' : 'blur(0px)',
                                        transition: 'background 260ms ease, backdrop-filter 260ms ease',
                                        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
                                    }}
                                    onClick={closeModal}
                                >
                                    <div
                                        className="relative w-full max-w-sm overflow-hidden rounded-[24px] border"
                                        style={{
                                            borderColor: `${accentColor}55`,
                                            background: 'linear-gradient(160deg, rgba(28,14,12,0.97) 0%, rgba(18,9,8,0.98) 100%)',
                                            boxShadow: `0 0 0 1px ${accentColor}30, 0 32px 80px rgba(0,0,0,0.7)`,
                                            transform: slotContinueModalVisible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.95)',
                                            opacity: slotContinueModalVisible ? 1 : 0,
                                            transition: 'transform 280ms cubic-bezier(0.34,1.4,0.64,1), opacity 220ms ease',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Thumbnail header */}
                                        <div className="relative h-28 overflow-hidden">
                                            <img src={slotSceneThumb} alt="" className="w-full h-full object-cover" draggable={false} />
                                            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${accentColor}22 0%, rgba(18,9,8,0.92) 100%)` }} />
                                            {slotHeroAvatarUrl && (
                                                <div className="absolute bottom-3 right-4">
                                                    <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
                                                        <div className="absolute inset-[-5px] rounded-[1.2rem] blur-lg" style={{ background: `${accentColor}44` }} />
                                                        <div className="relative h-full w-full overflow-hidden rounded-[1rem] border" style={{ borderColor: `${accentColor}aa`, background: 'linear-gradient(180deg, rgba(18,9,8,0.98) 0%, rgba(10,5,5,0.94) 100%)', boxShadow: `0 14px 28px rgba(0,0,0,0.45), inset 0 0 0 1px ${auraColor}22` }}>
                                                            <img src={slotHeroAvatarUrl} alt={`Avatar de ${slotClassLabel}`} className="h-full w-full scale-[1.08] object-cover object-center" draggable={false} />
                                                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, transparent 35%, rgba(10,5,5,0.24) 68%, rgba(10,5,5,0.62) 100%)' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute bottom-3 left-4 flex items-center gap-2.5">
                                                <div className="flex items-center justify-center w-9 h-9 rounded-full border-2" style={{ backgroundColor: `${accentColor}30`, borderColor: accentColor, color: auraColor }}>
                                                    <SlotClassIcon size={17} />
                                                </div>
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/60">Slot {slot.slotId}</div>
                                                    <div className="text-base font-black text-white leading-none">Nivel {slot.level ?? 1}</div>
                                                </div>
                                            </div>
                                            {/* Left accent stripe */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accentColor }} />
                                        </div>

                                        <div className="px-5 pt-4 pb-5">
                                            <div className="text-[11px] font-black uppercase tracking-[0.16em] mb-0.5" style={{ color: auraColor }}>
                                                {slotClassLabel}
                                            </div>
                                            <div className="text-xs text-[#f8dbc0]/70">{formatSaveDate(slot.savedAt)}</div>

                                            <div className="mt-4 grid grid-cols-2 gap-2.5">
                                                <button
                                                    onClick={closeModal}
                                                    className="hero-menu-action hero-menu-action-secondary"
                                                    style={{ fontSize: '0.8rem', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                >
                                                    {menuUiProfile === 'gamepad' && (() => {
                                                      const isSony = menuGamepadBrand === 'sony';
                                                      const color = isSony ? '#E80000' : '#E52420';
                                                      const label = isSony ? '○' : 'B';
                                                      return (
                                                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color, fontWeight: 900, fontSize: 12, fontFamily: 'system-ui,sans-serif', lineHeight: 1 }}>{label}</span>
                                                      );
                                                    })()}
                                                    <span>Cancelar</span>
                                                </button>
                                                <button
                                                    onClick={menuUiProfile !== 'gamepad' ? handleModalPlay : undefined}
                                                    className="hero-menu-action hero-menu-action-primary"
                                                    style={{ fontSize: '0.8rem', padding: '0.6rem 0.8rem', background: `linear-gradient(180deg, ${accentColor}cc 0%, ${accentColor}aa 100%)`, borderColor: `${accentColor}88`, boxShadow: `0 8px 24px ${accentColor}44`, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: menuUiProfile === 'gamepad' ? 'default' : undefined }}
                                                >
                                                    {menuUiProfile === 'gamepad' ? (() => {
                                                      const isSony = menuGamepadBrand === 'sony';
                                                      const label = isSony ? '✕' : 'A';
                                                      const btnColor = isSony ? '#0070D1' : '#107C10';
                                                      const arcColor = isSony ? '#00d4ff' : '#39ff6e';
                                                      const R = 13;
                                                      const circ = 2 * Math.PI * R;
                                                      const offset = circ * (1 - slotHoldProgress / 100);
                                                      return (
                                                        <span style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                          <svg width="32" height="32" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', filter: slotHoldProgress > 0 ? `drop-shadow(0 0 4px ${arcColor})` : 'none' }}>
                                                            <circle cx="16" cy="16" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                                                            <circle cx="16" cy="16" r={R} fill="none" stroke={arcColor} strokeWidth="3"
                                                              strokeDasharray={circ}
                                                              strokeDashoffset={offset}
                                                              strokeLinecap="round"
                                                              style={{ transition: slotHoldProgress === 0 ? 'none' : 'stroke-dashoffset 80ms linear' }}
                                                            />
                                                          </svg>
                                                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: btnColor, fontWeight: 900, fontSize: 11, fontFamily: 'system-ui,sans-serif', lineHeight: 1, zIndex: 1 }}>{label}</span>
                                                        </span>
                                                      );
                                                    })() : null}
                                                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Play size={13} className="shrink-0" /> Jogar</span>
                                                      {menuUiProfile === 'gamepad' && <span style={{ fontSize: '0.62rem', opacity: 0.7, fontWeight: 700 }}>segurar</span>}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {showClearSaveConfirmModal && canContinueSelectedSlot && selectedSlotSummary && (() => {
                            const slot = selectedSlotSummary;
                            const slotClassDef = slot.classId ? getPlayerClassById(slot.classId as PlayerClassId) : null;
                            const SlotClassIcon = (slot.classId ? SAVE_CLASS_ICON[slot.classId] : null) ?? Shield;
                            const slotSceneThumb = SAVE_SCENE_THUMBNAIL[slot.sceneRegion ?? 'forest'] ?? SAVE_THUMB_MOUNTAIN_URL;
                            const accentColor = slotClassDef?.visualProfile.secondaryColor ?? '#b87a3a';
                            const auraColor = slotClassDef?.visualProfile.auraColor ?? '#f8c77e';
                            const slotClassLabel = (slot.classId ? SAVE_CLASS_NAME_PT[slot.classId] : null) ?? slotClassDef?.name ?? slot.classId ?? 'Sem classe';
                            const slotHeroAvatarUrl = slotClassDef?.avatars.faceSquare.url ?? null;
                            const closeClearModal = () => {
                                setClearSaveModalVisible(false);
                                setTimeout(() => setShowClearSaveConfirmModal(false), 260);
                            };
                            const confirmClear = () => {
                                setClearSaveModalVisible(false);
                                setTimeout(() => { setShowClearSaveConfirmModal(false); handleClearSelectedSaveSlot(); }, 260);
                            };
                            // Sync refs so gamepad can trigger actions
                            clearModalCloseRef.current   = closeClearModal;
                            clearModalConfirmRef.current = confirmClear;
                            return (
                                <div
                                    className="absolute inset-0 z-30 flex items-end sm:items-center justify-center px-4"
                                    style={{
                                        background: clearSaveModalVisible ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
                                        backdropFilter: clearSaveModalVisible ? 'blur(10px)' : 'blur(0px)',
                                        WebkitBackdropFilter: clearSaveModalVisible ? 'blur(10px)' : 'blur(0px)',
                                        transition: 'background 260ms ease, backdrop-filter 260ms ease',
                                        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
                                    }}
                                    onClick={closeClearModal}
                                >
                                    <div
                                        className="relative w-full max-w-sm overflow-hidden rounded-[24px] border"
                                        style={{
                                            borderColor: '#c0392b55',
                                            background: 'linear-gradient(160deg, rgba(30,10,10,0.97) 0%, rgba(18,6,6,0.98) 100%)',
                                            boxShadow: '0 0 0 1px #c0392b30, 0 32px 80px rgba(0,0,0,0.7)',
                                            transform: clearSaveModalVisible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.95)',
                                            opacity: clearSaveModalVisible ? 1 : 0,
                                            transition: 'transform 280ms cubic-bezier(0.34,1.4,0.64,1), opacity 220ms ease',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Thumbnail header */}
                                        <div className="relative h-28 overflow-hidden">
                                            <img src={slotSceneThumb} alt="" className="w-full h-full object-cover opacity-60 grayscale" draggable={false} />
                                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(180,30,20,0.18) 0%, rgba(18,6,6,0.95) 100%)' }} />
                                            {slotHeroAvatarUrl && (
                                                <div className="absolute bottom-3 right-4">
                                                    <div className="relative h-14 w-14 shrink-0 opacity-95 sm:h-16 sm:w-16">
                                                        <div className="absolute inset-[-5px] rounded-[1.2rem] blur-lg" style={{ background: 'rgba(192, 57, 43, 0.34)' }} />
                                                        <div className="relative h-full w-full overflow-hidden rounded-[1rem] border" style={{ borderColor: '#c0392baa', background: 'linear-gradient(180deg, rgba(20,7,7,0.98) 0%, rgba(10,4,4,0.94) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
                                                            <img src={slotHeroAvatarUrl} alt={`Avatar de ${slotClassLabel}`} className="h-full w-full scale-[1.08] object-cover object-center grayscale" draggable={false} />
                                                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, transparent 35%, rgba(10,5,5,0.36) 68%, rgba(10,5,5,0.72) 100%)' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute bottom-3 left-4 flex items-center gap-2.5">
                                                <div className="flex items-center justify-center w-9 h-9 rounded-full border-2 opacity-60" style={{ backgroundColor: `${accentColor}30`, borderColor: accentColor, color: auraColor }}>
                                                    <SlotClassIcon size={17} />
                                                </div>
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/60">Slot {slot.slotId}</div>
                                                    <div className="text-base font-black text-white/70 leading-none line-through">Nivel {slot.level ?? 1}</div>
                                                </div>
                                            </div>
                                            {/* Danger stripe */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#c0392b' }} />
                                            {/* Warning badge */}
                                            <div className="absolute top-3 right-3 rounded-full bg-red-700/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">Excluir</div>
                                        </div>

                                        <div className="px-5 pt-4 pb-5">
                                            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-red-400">Confirmar exclus\u00e3o</div>
                                            <h3 className="mt-1 font-gamer text-xl font-black text-[#fff3df]">Desfazer este save?</h3>
                                            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: auraColor }}>
                                                {slotClassLabel}
                                            </div>
                                            <p className="mt-2 text-xs text-[#f8dcc0]/70">
                                                Todo o progresso do slot {slot.slotId} ser\u00e1 apagado permanentemente.
                                            </p>

                                            <div className="mt-4 grid grid-cols-2 gap-2.5">
                                                <button
                                                    onClick={closeClearModal}
                                                    className="hero-menu-action hero-menu-action-secondary"
                                                    style={{ fontSize: '0.8rem', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                >
                                                    {menuUiProfile === 'gamepad' && (() => {
                                                      const isSony = menuGamepadBrand === 'sony';
                                                      const color = isSony ? '#E80000' : '#E52420';
                                                      const label = isSony ? '○' : 'B';
                                                      return (
                                                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color, fontWeight: 900, fontSize: 12, fontFamily: 'system-ui,sans-serif', lineHeight: 1 }}>{label}</span>
                                                      );
                                                    })()}
                                                    <span>Cancelar</span>
                                                </button>
                                                <button
                                                    onClick={menuUiProfile !== 'gamepad' ? confirmClear : undefined}
                                                    className="hero-menu-action hero-menu-action-primary"
                                                    style={{ fontSize: '0.8rem', padding: '0.6rem 0.8rem', background: 'linear-gradient(180deg, #c0392bcc 0%, #a93226aa 100%)', borderColor: '#c0392b88', boxShadow: '0 8px 24px #c0392b44', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: menuUiProfile === 'gamepad' ? 'default' : undefined }}
                                                >
                                                    {menuUiProfile === 'gamepad' ? (() => {
                                                      const isSony = menuGamepadBrand === 'sony';
                                                      const label = isSony ? '✕' : 'A';
                                                      const btnColor = isSony ? '#0070D1' : '#107C10';
                                                      const arcColor = isSony ? '#00d4ff' : '#39ff6e';
                                                      const R = 13;
                                                      const circ = 2 * Math.PI * R;
                                                      const offset = circ * (1 - clearHoldProgress / 100);
                                                      return (
                                                        <span style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                          <svg width="32" height="32" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', filter: clearHoldProgress > 0 ? `drop-shadow(0 0 4px ${arcColor})` : 'none' }}>
                                                            <circle cx="16" cy="16" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                                                            <circle cx="16" cy="16" r={R} fill="none" stroke={arcColor} strokeWidth="3"
                                                              strokeDasharray={circ}
                                                              strokeDashoffset={offset}
                                                              strokeLinecap="round"
                                                              style={{ transition: clearHoldProgress === 0 ? 'none' : 'stroke-dashoffset 80ms linear' }}
                                                            />
                                                          </svg>
                                                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: btnColor, fontWeight: 900, fontSize: 11, fontFamily: 'system-ui,sans-serif', lineHeight: 1, zIndex: 1 }}>{label}</span>
                                                        </span>
                                                      );
                                                    })() : null}
                                                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                                                      <span>Confirmar</span>
                                                      {menuUiProfile === 'gamepad' && <span style={{ fontSize: '0.62rem', opacity: 0.7, fontWeight: 700 }}>segurar</span>}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
                <GamepadHint />
                <GamepadIndicator />
                <GamepadActionLegend
                  showCancel={showSlotContinueModal || showClearSaveConfirmModal}
                  extras={saveMenuFocusIdx < existingSaveSlots.length ? [{ button: 'skill2', text: 'Desfazer slot' }] : undefined}
                />
                </>
            );
        }

        return (
            <>
            <div className="w-full h-screen bg-[#ead6c2] overflow-hidden select-none">
                <ClassSelectionScreen
                    classes={PLAYER_CLASSES}
                    selectedClassId={selectedStartingClassId}
                    onSelect={setSelectedStartingClassId}
                    onConfirm={startGame}
                    onBack={() => setHasSavePromptDecision(false)}
                />
            </div>
            <GamepadHint />
            <GamepadIndicator />
            </>
        );
    }

  return (
    <div className="w-full h-screen bg-black overflow-hidden select-none">
            <SceneErrorBoundary>
                    <div style={{
                        position: 'absolute', inset: 0,
                        filter: resolvedGameState === GameState.GAME_OVER ? 'blur(10px) brightness(0.55)' : 'none',
                        transition: 'filter 0.55s ease',
                        willChange: 'filter',
                    }}>
                    <GameScene 
                        enemyColor={enemy?.color || '#ff0000'} 
                        enemyScale={enemy?.scale || 1}
                                        enemyName={enemy?.name}
                        turnState={turnState}
                        onGameTimeUpdate={setGameTime}
                                playerAnimationAction={resolvedGameState === GameState.TAVERN
                                    ? menuHeroAction
                                    : playerAnimationAction === 'defend-hit' || playerAnimationAction === 'evade'
                                        ? playerAnimationAction
                                        : isDefenseAnimationActive && (playerAnimationAction === 'idle' || playerAnimationAction === 'battle-idle')
                                            ? 'defend'
                                            : playerAnimationAction === 'idle' && resolvedGameState === GameState.BATTLE
                                                ? 'battle-idle'
                                                : playerAnimationAction}
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
                        enemyGltfModelUrl={enemy?.gltfModelUrl}
                        enemyGltfBodyType={enemy?.gltfBodyType}
                        playerExecutionAnimationId={playerExecutionAnimationId}
                        enemyExecutionAnimationId={enemyExecutionAnimationId}
                        playerExecutionAnimationTintColor={playerExecutionAnimationTintColor}
                        enemyExecutionAnimationTintColor={enemyExecutionAnimationTintColor}
                        playerImpactAnimationId={playerImpactAnimationId}
                        enemyImpactAnimationId={enemyImpactAnimationId}
                        playerImpactAnimationTintColor={playerImpactAnimationTintColor}
                        enemyImpactAnimationTintColor={enemyImpactAnimationTintColor}
                        playerImpactAnimationTarget={playerImpactAnimationTarget}
                        enemyImpactAnimationTarget={enemyImpactAnimationTarget}
                        playerImpactAnimationTrigger={playerImpactAnimationTrigger}
                        enemyImpactAnimationTrigger={enemyImpactAnimationTrigger}
                        playerBowShotTrigger={playerBowShotTrigger}
                        enemyBowShotTrigger={enemyBowShotTrigger}
                        playerBowShotDidHit={playerBowShotDidHit}
                        enemyBowShotDidHit={enemyBowShotDidHit}
                        enemyType={enemy?.type || 'beast'}
                        isEnemyBoss={enemy?.isBoss}
                        isPlayerDefending={isDefenseAnimationActive}
                        playerDefenseType={player.tipoDefesaAtiva ?? null}
                        isEnemyDefending={enemy?.isDefending}
                        isPlayerHit={isPlayerHit}
                        isPlayerCritHit={isPlayerCritHit}
                        isEnemyHit={isEnemyHit}
                        hasPerfectEvadeAura={player.buffs.perfectEvadeTurns > 0}
                        hasDoubleAttackAura={player.buffs.doubleAttackTurns > 0}
                        impulseLevel={player.impulso}
                        activeImpulseLevel={player.impulsoAtivo}
                        screenShake={screenShake}
                        isLevelingUp={isLevelingUp}
                        levelUpCardCategory={levelUpCardCategory}
                        stage={stage}
                        playerClassId={player.classId}
                        isDungeonRun={Boolean(dungeonRun)}
                        playerState={player}
                        enemyState={enemy}
                        enemyIntentPreview={enemyIntentPreview}
                        battleTimelineState={battleTimelineState}
                        activeBattleActorId={activeBattleActorId}
                        battleActorGauges={battleActorGauges}
                        battleActionsConfig={resolvedGameState === GameState.BATTLE ? battleActionsConfig : undefined}
                        isMenuView={resolvedGameState === GameState.TAVERN}
                        menuCameraFocus={shouldMenuCameraFocus}
                        heroInspectMode={heroInspectMode}
                        onHeroInspectClose={() => {
                            setHeroInspectMode(false);
                            setHeroInspectCloseToken((prev) => prev + 1);
                        }}
                        onHeroEquipSlotClick={(slot) => {
                            setHeroEquipOpenFilter(slot);
                            setHeroEquipOpenToken((prev) => prev + 1);
                        }}
                        onHeroUnequipSlotClick={(item) => {
                            unequipItem(item);
                        }}
                        onHeroSkillSlotClick={(slotIndex) => {
                            setHeroSkillSlotOpenIndex(slotIndex);
                            setHeroSkillSlotOpenToken((prev) => prev + 1);
                        }}
                        onHeroItemSlotClick={(slotIndex) => {
                            setHeroItemSlotOpenIndex(slotIndex);
                            setHeroItemSlotOpenToken((prev) => prev + 1);
                        }}
                        onHeroUnequipItemSlot={(slotIndex) => {
                            equipItemToSlot(slotIndex, null);
                        }}
                        onHeroUnequipSkillSlot={(slotIndex) => {
                            equipSkillToSlot(slotIndex, null);
                        }}
                        isDungeonScene={sceneRegion === 'dungeon' || sceneRegion === 'tower'}
                        showMenuNavigationPortal={resolvedGameState === GameState.TAVERN}
                        menuPortalRegion={sceneRegion === 'tower' ? 'tower' : sceneRegion === 'dungeon' ? 'dungeon' : 'forest'}
                        menuPortalTravelCinematicToken={menuPortalTravelCinematicToken}
                        onMenuPortalClick={handleOpenPortalTravel}
                        portalInspectMode={portalInspectMode}
                        currentSceneRegion={sceneRegion}
                        dungeonUnlocked={isDungeonUnlocked}
                        towerUnlocked={true}
                        onPortalInspectClose={() => setPortalInspectMode(false)}
                        onPortalTravelTo={(region) => {
                            setPortalInspectMode(false);
                            handleNavigateSceneRegion(region);
                        }}
                        menuGamepadFocus={resolvedGameState === GameState.TAVERN && !portalInspectMode ? campGamepadFocusForScene : null}
                        renderQualityPreset={battleSettings.renderQualityPreset}
                        onMenuHeroClick={resolvedGameState === GameState.TAVERN || resolvedGameState === GameState.BATTLE ? handleMenuHeroClick : undefined}
                        lootResult={lootResult}
                        xpIconComponent={xpIconComponent}
                        additionalEnemies={additionalEnemies}
                        pendingTargetAction={pendingTargetAction}
                        onSelectTarget={handleSelectTarget}
                        onCancelTargetSelection={handleCancelTargetSelection}
                        mainEnemySlotIndex={mainEnemySlotIndex}
                        initialGroupSize={initialGroupSize}
                        onHeroNameplateClick={() => setShowHeroDetailModal(true)}
                    />
                    </div>
            </SceneErrorBoundary>

            {/* Target selection card overlay — shown when pendingTargetAction is active */}
            {(pendingTargetAction || targetCardLeaving) && (() => {
                const ta = pendingTargetAction;
                if (!ta && !targetCardLeaving) return null;
                const resolvedTa = ta ?? { type: 'attack' as const };
                const isSkill = resolvedTa.type === 'skill';
                const skill = isSkill && resolvedTa.type === 'skill' ? resolvedTa.skill : null;
                const isMagic = isSkill && skill?.type === 'magic';
                const isHeal = isSkill && skill?.type === 'heal';
                const actionLabel = isSkill && skill ? skill.name : 'Atacar';
                // Icon and color based on action type
                const iconColor = isHeal ? '#4ade80' : isMagic ? '#c084fc' : '#f87171';
                const IconComp = isHeal ? Heart : isMagic ? Sparkles : (isSkill ? Swords : Sword);
                const cardAccent = iconColor;
                return (
                    <div
                        style={{
                            position: 'absolute', inset: 0, zIndex: 300,
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
                            pointerEvents: 'none',
                        }}
                    >
                        <div
                            style={{
                                pointerEvents: 'auto',
                                backdropFilter: 'blur(28px)',
                                WebkitBackdropFilter: 'blur(28px)',
                                background: 'rgba(6,4,18,0.82)',
                                border: `1.5px solid ${cardAccent}55`,
                                borderRadius: '20px',
                                padding: '14px 24px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: `0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px ${cardAccent}22`,
                                fontFamily: "'Segoe UI',system-ui,sans-serif",
                                minWidth: '200px',
                                maxWidth: '80vw',
                                animation: targetCardLeaving
                                    ? 'target-select-card-out 0.22s cubic-bezier(0.4,0,0.6,1) both'
                                    : 'target-select-card-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
                            }}
                        >
                            {/* Action icon + name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '10px',
                                    background: `${cardAccent}22`,
                                    border: `1.5px solid ${cardAccent}55`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: `0 0 12px ${cardAccent}44`,
                                }}>
                                    <IconComp size={16} color={cardAccent} strokeWidth={2.5} />
                                </div>
                                <span style={{
                                    fontSize: '14px', fontWeight: 900,
                                    textTransform: 'uppercase', letterSpacing: '0.12em',
                                    color: '#fff',
                                }}>{actionLabel}</span>
                            </div>
                            {/* Instruction */}
                            <span style={{
                                fontSize: '11px', color: 'rgba(255,255,255,0.50)',
                                letterSpacing: '0.06em', fontWeight: 600,
                            }}>Selecione um alvo</span>
                            {/* Cancel button */}
                            <button
                                onClick={handleCancelTargetSelection}
                                style={{
                                    marginTop: '2px',
                                    background: 'rgba(255,255,255,0.07)',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    borderRadius: '10px',
                                    padding: '6px 18px',
                                    color: 'rgba(255,255,255,0.55)',
                                    fontSize: '10px',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    cursor: 'pointer',
                                }}
                            >Cancelar ação</button>
                        </div>
                    </div>
                );
            })()}

            {/* Portal travel overlay — covers scene swap while new region loads */}
            {portalSceneOverlay && (() => {
                const pov = portalSceneOverlay;
                const povThumb = SAVE_SCENE_THUMBNAIL[pov.targetRegion] ?? SAVE_THUMB_MOUNTAIN_URL;
                const regionLabel: Record<SceneRegion, string> = { forest: 'Montanha', dungeon: 'Dungeon', tower: 'Torre' };
                // key={pov.phase} forces a DOM remount on each phase change so the browser
                // always starts the animation fresh from the first keyframe.
                // fill-mode: both → 'from' keyframe is applied instantly on mount (no flash).
                const clipAnim =
                    pov.phase === 'in'  ? 'portal-wipe-in 420ms ease-in-out both' :
                    pov.phase === 'out' ? 'portal-wipe-out 660ms ease-in-out both' :
                    'none';
                return (
                    <div
                        key={pov.phase}
                        className="absolute inset-0 z-[998] pointer-events-none"
                        style={{ animation: clipAnim }}
                    >
                        <div className="absolute inset-0">
                            <img src={povThumb} alt="" className="w-full h-full object-cover" draggable={false} />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(6,3,3,0.38) 0%, rgba(6,3,3,0.80) 60%, rgba(6,3,3,0.97) 100%)' }} />
                        </div>
                        {/* Center label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <div
                                className="font-gamer text-3xl font-black text-white"
                                style={{
                                    textShadow: '0 2px 24px rgba(0,0,0,0.8)',
                                    animation: pov.phase !== 'out' ? 'splash-text-in 420ms ease both' : 'none',
                                }}
                            >
                                {regionLabel[pov.targetRegion]}
                            </div>
                            <div
                                className="text-[10px] font-black uppercase tracking-[0.26em] text-white/46"
                                style={{ animation: pov.phase !== 'out' ? 'splash-text-in 400ms 100ms ease both' : 'none' }}
                            >
                                Viajando pelo portal...
                            </div>
                            {/* Pulsing portal ring */}
                            <div
                                className="mt-2 w-12 h-12 rounded-full border-2 border-white/30"
                                style={{ animation: pov.phase !== 'out' ? 'portal-ring-pulse 1.2s ease-in-out infinite' : 'none' }}
                            />
                        </div>
                    </div>
                );
            })()}

            {/* Global loading splash — sits over the game scene while 3D assets warm up */}
            {loadingSplash && (() => {
                const sp = loadingSplash;
                const spClassDef = sp.slot.classId ? getPlayerClassById(sp.slot.classId as PlayerClassId) : null;
                const SpClassIcon = (sp.slot.classId ? SAVE_CLASS_ICON[sp.slot.classId] : null) ?? Shield;
                const spThumb = SAVE_SCENE_THUMBNAIL[sp.slot.sceneRegion ?? 'forest'] ?? SAVE_THUMB_MOUNTAIN_URL;
                const spAccent = spClassDef?.visualProfile.secondaryColor ?? '#b87a3a';
                const spAura = spClassDef?.visualProfile.auraColor ?? '#f8c77e';
                return (
                    <div
                        className="absolute inset-0 z-[999] flex flex-col pointer-events-none"
                        style={{
                            opacity: sp.visible ? 1 : 0,
                            transition: sp.visible ? 'opacity 320ms ease' : 'opacity 600ms ease 2800ms',
                        }}
                        onTransitionEnd={() => {
                            // Remove from DOM after fade-out
                            if (!sp.visible) setLoadingSplash(null);
                        }}
                    >
                        {/* Full-bleed scenario image */}
                        <div className="absolute inset-0">
                            <img src={spThumb} alt="" className="w-full h-full object-cover" draggable={false} />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,5,5,0.22) 0%, rgba(10,5,5,0.70) 55%, rgba(10,5,5,0.97) 100%)' }} />
                            <div className="absolute inset-x-0 bottom-0 h-56" style={{ background: `linear-gradient(to top, ${spAccent}28, transparent)` }} />
                        </div>

                        {/* Hero info — bottom */}
                        <div
                            className="absolute inset-x-0 bottom-0 px-6 flex flex-col items-center"
                            style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 3rem))' }}
                        >
                            <div
                                className="flex items-center justify-center w-16 h-16 rounded-full border-2 mb-4"
                                style={{
                                    backgroundColor: `${spAccent}22`,
                                    borderColor: spAccent,
                                    color: spAura,
                                    boxShadow: `0 0 36px ${spAccent}66`,
                                    animation: sp.visible ? 'splash-icon-in 520ms cubic-bezier(0.34,1.4,0.64,1) both' : 'none',
                                }}
                            >
                                <SpClassIcon size={28} />
                            </div>

                            <div
                                className="text-center"
                                style={{ animation: sp.visible ? 'splash-text-in 440ms 80ms ease both' : 'none' }}
                            >
                                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/48 mb-0.5">Slot {sp.slot.slotId}</div>
                                <div className="font-gamer text-4xl font-black text-white leading-none mb-1">Nivel {sp.slot.level ?? 1}</div>
                                <div className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: spAura }}>
                                    {(sp.slot.classId ? SAVE_CLASS_NAME_PT[sp.slot.classId] : null) ?? spClassDef?.name ?? sp.slot.classId ?? ''}
                                </div>
                                <div className="mt-1 text-xs text-white/38">{formatSaveDate(sp.slot.savedAt)}</div>
                            </div>

                            <div className="mt-6 w-full max-w-xs">
                                <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.11)' }}>
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            background: `linear-gradient(90deg, ${spAccent}, ${spAura})`,
                                            animation: sp.visible ? 'splash-bar 3.0s ease-in-out both' : 'none',
                                            boxShadow: `0 0 8px ${spAura}88`,
                                        }}
                                        onAnimationEnd={() => {
                                            // Bar finished — trigger fade-out
                                            setLoadingSplash(prev => prev ? { ...prev, visible: false } : prev);
                                        }}
                                    />
                                </div>
                                <div
                                    className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-white/36"
                                    style={{ animation: sp.visible ? 'splash-text-in 400ms 220ms ease both' : 'none' }}
                                >
                                    Carregando...
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {resolvedGameState === GameState.MENU && <MenuScreen onStart={startGame} />}
      
                        {resolvedGameState === GameState.TAVERN && showTavernUi && (
          <TavernScreen 
            player={player}
            stage={stage}
            killCount={killCount}
                        dungeonEvolution={dungeonEvolution}
                        dungeonTotalMonsters={getDungeonMonsterTarget(dungeonEvolution)}
            onHunt={() => enterBattle(false)}
            onBoss={() => enterBattle(true)}
            onDungeon={startDungeon}
            sceneRegion={sceneRegion}
            onNavigateSceneRegion={handleNavigateSceneRegion}
            onShop={() => {
                setShopReturnToInventory(false);
                setOpenInventoryFromShopToken(0);
                setOpenInventoryFromShopFilter('all');
                if (hasUnlockedMusic) {
                    uiSfx.play('modal_open');
                }
                setGameState(GameState.SHOP);
            }}
            onShopFromInventory={(filter) => {
                setShopReturnToInventory(true);
                setShopReturnInventoryFilter(filter);
                if (hasUnlockedMusic) {
                    uiSfx.play('modal_open');
                }
                setGameState(GameState.SHOP);
            }}
                        onAlchemist={() => {
                            if (hasUnlockedMusic) {
                                uiSfx.play('modal_open');
                            }
                            setGameState(GameState.ALCHEMIST);
                        }}
            shopItems={ALL_ITEMS}
            autoOpenConstellationToken={openConstellationToken}
            autoOpenInventoryToken={openInventoryFromShopToken}
            autoOpenInventoryFilter={openInventoryFromShopFilter}
            autoOpenPortalTravelToken={openPortalTravelToken}
            autoOpenProfileToken={openProfileFromHeroToken}
            onEquipItem={equipItem}
            onUnequipItem={unequipItem}
            onUseItem={handleUseItem}
            onSellItem={sellItem}
            onUnlockTalent={handleUnlockTalent}
            onResetTalents={handleResetTalents}
                        campIntroOnly={isCampIntroRestricted}
                        restrictProfileToStatusOnly={isProfileStatusOnly}
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
                        constellationRespecUnlockPromptActive={constellationRespecUnlockPromptPending}
                        onAcknowledgeConstellationRespecUnlock={() => {
                            setConstellationRespecUnlockPromptPending(false);
                        }}
                        allowCardsInProfile={isCardsUnlocked}
                        fleeUnlocked={isFleeUnlocked}
                        merchantUnlockPromptActive={onboardingPhase === 'merchant_prompt'}
                        onAcknowledgeMerchantUnlock={() => setOnboardingPhase('merchant_unlocked')}
                        dungeonUnlockPromptActive={onboardingPhase === 'dungeon_prompt'}
                        onAcknowledgeDungeonUnlock={() => setOnboardingPhase('dungeon_unlocked')}
                        alchemistUnlockPromptActive={onboardingPhase === 'alchemist_prompt'}
                        onAcknowledgeAlchemistUnlock={() => setOnboardingPhase('alchemist_unlocked')}
                        merchantUnlocked={isMerchantUnlocked}
                        dungeonUnlocked={isDungeonUnlocked}
                        alchemistUnlocked={isAlchemistUnlocked}
                        showSkillsAction={isSkillsActionUnlocked}
                        showDiamondHud={hasDiamondHudUnlocked}
                        onTower={handleEnterTower}
                        towerEssence={towerMeta.essence}
                        gameTime={gameTime}
                        autoOpenHeroInspectToken={openHeroInspectToken}
                        onHeroInspectOpen={() => setHeroInspectMode(true)}
                        onHeroInspectClose={() => setHeroInspectMode(false)}
                        closeHeroInspectToken={heroInspectCloseToken}
                        autoOpenHeroEquipToken={heroEquipOpenToken}
                        autoOpenHeroEquipFilter={heroEquipOpenFilter}
                        autoOpenSkillsToken={heroSkillSlotOpenToken}
                        autoOpenSkillsSlotIndex={heroSkillSlotOpenIndex}
                        autoOpenItemSlotToken={heroItemSlotOpenToken}
                        autoOpenItemSlotIndex={heroItemSlotOpenIndex}
                        portalInspectMode={portalInspectMode}
                        portalTransitioning={portalTransitioning}
                        onPortalInspectOpen={handleOpenPortalTravel}
                        onPortalInspectClose={() => setPortalInspectMode(false)}
                        onGamepadFocusChange={setCampGamepadFocusForScene}
                        onEquipSkillToSlot={equipSkillToSlot}
                        onEquipItemToSlot={equipItemToSlot}
                        missions={missions}
                        missionsUnlocked={isMissionsUnlocked}
                        onClaimMissionReward={claimMissionReward}
                        missionsUnlockPromptActive={onboardingPhase === 'missions_prompt'}
                        onAcknowledgeMissionsUnlock={() => setOnboardingPhase('missions_unlocked')}
                        autoOpenMissionsToken={openMissionsFromToastToken}
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
            huntStage={stage}
            onBuy={buyItem} 
            onSell={sellItem}
            onEquip={equipItem}
            onUnequip={unequipItem}
            onLeave={() => {
                if (shopReturnToInventory) {
                    setOpenInventoryFromShopFilter(shopReturnInventoryFilter);
                    setOpenInventoryFromShopToken((prev) => prev + 1);
                    setShopReturnToInventory(false);
                }
                if (hasUnlockedMusic) {
                    uiSfx.play('modal_close');
                }
                setGameState(GameState.TAVERN);
            }} 
        />
      )}

            {resolvedGameState === GameState.ALCHEMIST && (
                <AlchemistScreen
                        player={player}
                        offers={alchemistCardOffers}
                    itemOffers={ALCHEMIST_ITEM_OFFERS}
                        onBuyCard={buyAlchemistCard}
                    onBuyItem={buyAlchemistItem}
                            onLeave={() => {
                                if (hasUnlockedMusic) {
                                    uiSfx.play('modal_close');
                                }
                                setGameState(GameState.TAVERN);
                            }}
                />
            )}

    {resolvedGameState === GameState.BATTLE && (
        <BattleHUD 
            player={player}
            enemy={enemy}
        gameState={resolvedGameState}
            turnState={turnState}
            logs={logs}
            onAttack={handleAttackWithTargetCheck}
            onDefend={handlePlayerDefenseWithTimeline}
            onChargeImpulse={handleChargeImpulseWithTimeline}
            onAbsorbImpulse={handleAbsorbImpulse}
            onSkill={handleSkillWithTargetCheck}
            onUseItem={handleUseItemWithTimeline}
            enemyIntentPreview={enemyIntentPreview}
            additionalEnemies={additionalEnemies}
            pendingTargetAction={pendingTargetAction}
            onSelectTarget={handleSelectTarget}
            onCancelTargetSelection={handleCancelTargetSelection}
            onUnlockTalent={handleUnlockTalent}
            onResetTalents={handleResetTalents}
            onStartBattle={(isBoss) => enterBattle(isBoss)}
            onEnterShop={() => {}} // Disabled in battle
            onBuyItem={buyItem}
            onSellItem={sellItem}
            onEquipItem={equipItem}
            onUnequipItem={unequipItem}
            onContinue={() => {}}
            onFlee={handleFlee}
            currentNarration={narration}
            shopItems={ALL_ITEMS}
            floatingTexts={floatingTexts}
            stage={stage}
            dungeonPhase={activeDungeonPhase}
            killCount={killCount}
            isDungeonRun={Boolean(dungeonRun)}
            showDiamondHud={hasDiamondHudUnlocked}
            diamondUnlockPromptActive={diamondUnlockPromptPending}
            onAcknowledgeDiamondUnlock={() => setDiamondUnlockPromptPending(false)}
                        dungeonRewards={dungeonRun?.rewards ?? null}
            dungeonCleared={dungeonRun?.rewards.clearedMonsters ?? 0}
            dungeonTotal={dungeonRun?.rewards.totalMonsters ?? 30}
            gameTime={gameTime}
            autoOpenProfileToken={openProfileFromHeroToken}
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
                                                impulseUnlockPromptActive={impulseUnlockPromptQueue[0] ?? null}
                                                onAcknowledgeImpulseUnlock={() => {
                                                    setImpulseUnlockPromptQueue((prev) => prev.slice(1));
                                                }}
                                                constellationUnlockPromptActive={constellationUnlockPromptPending}
                                                onAcknowledgeConstellationUnlock={() => {
                                                    setConstellationUnlockPromptPending(false);
                                                }}
                                                constellationRespecUnlockPromptActive={constellationRespecUnlockPromptPending}
                                                onAcknowledgeConstellationRespecUnlock={() => {
                                                    setConstellationRespecUnlockPromptPending(false);
                                                }}
                                                                                                itemsUnlockPromptActive={onboardingPhase === 'items_prompt'}
                                                                                                onAcknowledgeItemsUnlock={() => setOnboardingPhase('flee_prompt')}
                                                                                                fleeUnlockPromptActive={onboardingPhase === 'flee_prompt'}
                                                                                                onAcknowledgeFleeUnlock={() => setOnboardingPhase('flee_unlocked')}
                                                allowCardsInProfile={isCardsUnlocked}
                                                                                                fleeUnlocked={isFleeUnlocked}
                                                                                                musicEnabled={battleSettings.musicEnabled}
                                                                                                sfxEnabled={battleSettings.sfxEnabled}
                                                                                                renderQualityPreset={battleSettings.renderQualityPreset}
                                                                                                recommendedRenderQualityPreset={recommendedRenderQualityPreset}
                                                                                                onUpdateBattleSettings={updateBattleSettings}
                                                                                                onBattleSettingsOpenChange={setIsBattleSettingsModalOpen}
                                                                                                onEquipSkillToSlot={equipSkillToSlot}
                                                                                                towerEssence={towerMeta.essence}
                                                                                                sceneRegion={sceneRegion}
                        missions={missions}
                        missionsUnlocked={isMissionsUnlocked}
                        onClaimMissionReward={claimMissionReward}
                        missionsUnlockPromptActive={onboardingPhase === 'missions_prompt'}
                        onAcknowledgeMissionsUnlock={() => setOnboardingPhase('missions_unlocked')}
                        autoOpenMissionsToken={openMissionsFromToastToken}
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

                setPlayer((prev) => ({
                    ...prev,
                    stats: {
                        ...prev.stats,
                        hp: prev.stats.maxHp,
                        mp: prev.stats.maxMp,
                    },
                    isDefending: false,
                    isDefendendo: false,
                    tipoDefesaAtiva: null,
                    buffs: createEmptyBuffState(),
                    statusEffects: [],
                }));
                setNarration('Voce retornou da dungeon totalmente recuperado.');

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
          />
      )}

      {resolvedGameState === GameState.BOSS_VICTORY && onboardingPhase === 'cards_prompt' && (
          <div className="absolute inset-0 z-[95] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 pointer-events-auto">
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={(event) => event.stopPropagation()}>
                  <div className="px-5 py-4 border-b border-[#dcc0aa] bg-[#6b3141] text-[#f6eadc]">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em]">Evolucao</div>
                      <h3 className="mt-1 text-2xl font-black text-white">Cartas liberadas</h3>
                      <p className="mt-1.5 text-sm text-[#dcc0aa]">Sua primeira carta foi registrada. Agora o menu de cartas esta disponivel no perfil.</p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => setOnboardingPhase('cards_unlocked')}
                          className="w-full rounded-xl border border-[#7d3d4d] bg-[#6b3141] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#f7eadf] transition-colors hover:bg-[#7a3d4d]"
                      >
                          Ver cartas
                      </button>
                  </div>
              </div>
          </div>
      )}

      {resolvedGameState === GameState.GAME_OVER && (
          <GameOverScreen stage={stage} onRespawn={respawnAtCamp} />
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

      {levelUpModal && (
          <div className="absolute inset-0 z-[88] flex items-center justify-center p-4 pointer-events-none">
              <div
                  className="relative w-full max-w-[276px] overflow-hidden rounded-[20px] border bg-[linear-gradient(165deg,#fffaf3,#f4e8db)] shadow-[0_20px_58px_rgba(54,26,33,0.2)] animate-fade-in-down"
                  style={{
                      borderColor: `${heroClassAccentColor}88`,
                      boxShadow: `0 20px 58px ${heroClassAuraColor}36`,
                  }}
              >
                  <div className="pointer-events-none absolute -left-10 top-5 h-20 w-20 rounded-full blur-2xl" style={{ backgroundColor: `${heroClassAuraColor}55` }} />
                  <div className="pointer-events-none absolute -right-8 bottom-3 h-16 w-16 rounded-full blur-2xl" style={{ backgroundColor: `${heroClassAccentColor}44` }} />
                  <div
                      className="relative px-4 py-3 text-center text-[#f7ecdd]"
                      style={{
                          background: `linear-gradient(135deg, ${heroClassAccentColor}, ${heroClassAuraColor})`,
                      }}
                  >
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em]">
                          Nivel Up
                      </div>
                      <h3 className="mt-1.5 text-lg font-black text-white">Voce evoluiu</h3>
                      <p className="mt-1 text-[11px] text-[#f7ecdd]">Classe: {heroClassDefinition.name} | Nivel {levelUpModal.nextLevel}</p>
                  </div>
                  <div className="relative px-4 py-3.5">
                      <div className="rounded-xl border bg-[#fff9f1]/95 px-3 py-2.5 text-center shadow-inner" style={{ borderColor: `${heroClassAccentColor}40` }}>
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Ponto de evolucao</div>
                          <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-[#f4e5d4] px-3 py-1.5" style={{ borderColor: `${heroClassAccentColor}66` }}>
                              <span
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full shadow-[0_0_16px_rgba(0,0,0,0.2)] animate-pulse"
                                  style={{
                                      backgroundColor: `${heroClassAuraColor}22`,
                                      border: `1.5px solid ${heroClassAccentColor}`,
                                      color: heroClassAccentColor,
                                  }}
                              >
                                  <Orbit size={14} strokeWidth={2.4} />
                              </span>
                              <span className="text-lg font-black text-[#6b3141]">+{levelUpModal.levelsGained} PE</span>
                          </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#ebdbc9]">
                          <div className="h-full rounded-full" style={{ width: '100%', background: `linear-gradient(90deg, ${heroClassAccentColor}, ${heroClassAuraColor})` }} />
                      </div>
                  </div>
              </div>
          </div>
      )}

      {resolvedGameState === GameState.TOWER_HUB && (
          <TowerHubScreen
              player={player}
              towerMeta={towerMeta}
              availableConsumables={ALL_ITEMS.filter(i => i.type === 'potion')}
              onStartRun={handleStartTowerRun}
              onUpgradeSlots={handleUpgradeTowerSlots}
              onBack={() => setGameState(GameState.TAVERN)}
          />
      )}
      {resolvedGameState === GameState.TOWER_MAP && towerRun && (
          <TowerMapScreen
              player={player}
              towerRun={towerRun}
              activeEvent={towerActiveEvent}
              cardOffer={towerCardOffer}
              shopItems={towerShopItems}
              onNodeSelect={handleTowerNodeSelect}
              onEventChoice={handleTowerEventChoice}
              onCardPick={handleTowerCardPick}
              onShopBuy={handleTowerShopBuy}
              onShopClose={() => {
                  setTowerShopItems(null);
                  setTowerRun(prev => {
                      if (!prev || !prev.selectedNodeId) return prev;
                      const nodeId = prev.selectedNodeId;
                      const newMap = completeNode(prev.currentFloorMap, nodeId);
                      return { ...prev, currentFloorMap: newMap, selectedNodeId: null, completedNodeIds: [...prev.completedNodeIds, nodeId] };
                  });
              }}
              onFlee={() => { setTowerResultOutcome('withdrawal'); handleTowerReturnToHub(); }}
          />
      )}
      {resolvedGameState === GameState.TOWER_SANCTUARY && towerRun && (
          <TowerSanctuaryScreen
              floor={towerRun.floor}
              act={towerRun.act}
              options={towerSanctuaryOptions}
              onChoose={handleTowerSanctuaryChoose}
          />
      )}
      {resolvedGameState === GameState.TOWER_RESULT && towerRun && (
          <TowerResultScreen
              towerRun={towerRun}
              outcome={towerResultOutcome}
              runItems={towerRunItems}
              onReturnToHub={handleTowerReturnToHub}
          />
      )}

      {/* ── Admin Panel — visible only with ?admin=true in URL ── */}
      {isAdminMode && (
        <AdminPanel
          player={player}
          stage={stage}
          dungeonEvolution={dungeonEvolution}
          towerEssence={towerMeta.essence}
          onSetLevel={handleAdminSetLevel}
          onSetStage={(s) => setStage(Math.max(1, s))}
          onSetDungeonEvolution={(d) => setDungeonEvolution(Math.max(0, d))}
          onAddGold={(amount) => setPlayer(prev => ({ ...prev, gold: prev.gold + amount }))}
          onAddDiamonds={(amount) => setPlayer(prev => ({ ...prev, diamonds: prev.diamonds + amount }))}
          onAddEssence={(amount) => setTowerMeta(prev => ({ ...prev, essence: prev.essence + amount }))}
          onForceEquip={handleAdminForceEquip}
        />
      )}

      {/* ── Gamepad hint — exibido quando controle detectado mas sem input ainda ── */}
      <GamepadHint />
      {/* ── Gamepad indicator — badge bottom-left quando controle está ativo ── */}
      <GamepadIndicator />
      {/* ── Mission completed toast ── */}
      <MissionToast
        toast={missionToast}
        onOpen={() => {
          setMissionToast(null);
          // Open missions modal in whichever screen is active
          setOpenMissionsFromToastToken(t => t + 1);
        }}
      />
      {showHeroDetailModal && (
        <HeroProfileDetailModal player={player} uiProfile={appUiProfile} onClose={() => setShowHeroDetailModal(false)} />
      )}
    </div>
  );
}




