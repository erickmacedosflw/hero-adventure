
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ShoppingBag, Play, Sword, Home, Orbit } from 'lucide-react';
import { DeveloperConsole } from './components/DeveloperConsole';
import { GameScene } from './components/Scene3D';
import { OpeningScreen } from './components/OpeningScreen';
import { ClassSelectionScreen } from './components/ClassSelectionScreen';
import { BattleHUD, MenuScreen, ShopScreen, TavernScreen, KillLootOverlay, CardChoiceScreen, AlchemistScreen, DungeonResultScreen, BossVictoryModal } from './components/GameUI';
import { 
    Player, Enemy, EnemyIntentPreview, GameState, TurnState, BattleLog, Item, Skill, Stats, Particle, FloatingText, ProgressionCard, CardRewardOffer, AlchemistCardOffer, AlchemistItemOffer, DungeonRunState, DungeonResult, DungeonRewards, EnemyTemplate, DungeonEnemyTemplate, DungeonBossTemplate, PlayerAnimationAction, BossVictoryContext, CardCategory
} from './types';
import { 
    INITIAL_PLAYER, SHOP_ITEMS, ALL_ITEMS, MATERIALS, SKILLS, ENEMY_DATA, ENEMY_COLORS, DUNGEON_ENEMY_DATA, DUNGEON_BOSS, ALCHEMIST_ITEM_OFFERS 
} from './constants';
import { PROGRESSION_CARDS, ALCHEMIST_CARDS } from './game/data/cards';
import { applyPlayerClass, getPlayerClassById, PLAYER_CLASSES } from './game/data/classes';
import { gameMusicManager, isNightTime, type MusicTrackId } from './game/audio/music';
import { battleSfx } from './game/audio/sfx';
import { uiSfx } from './game/audio/uiSfx';
import { createEmptyBuffState } from './game/mechanics/combat';
import { createClassResourceState, getTalentBonuses, getUnlockedResourceMax, resetTalentNodes, syncPlayerConstellationSkills, unlockTalentNode } from './game/mechanics/classProgression';
import { buyItemForPlayer, sellItemFromPlayer } from './game/mechanics/inventory';
import { applyEquipmentBonusesToStats } from './game/mechanics/equipmentBonuses';
import { warmupBattleRuntimeAssets } from './game/mechanics/assetWarmup';
import { WeaponProficiencyAppliedBonuses, applyWeaponProficiencyBonusesToStats, getWeaponProficiencyAppliedBonuses } from './game/mechanics/weaponProficiency';
import { SavePayload, SaveSlotId, SaveSlotSummary, getActiveSaveSlotId, listSaveSlots, loadSaveFromSlot, saveToActiveSlot, setActiveSaveSlotId, clearSlot } from './game/mechanics/saveSystem';
import { useBattleController } from './game/hooks/useBattleController';
import { useBattleResolution } from './game/hooks/useBattleResolution';
import { generateBattleDescription, generateVictorySpeech } from './services/battleNarrationService';
import { getDefaultRenderQualityPreset, type RenderQualityPreset } from './components/scene3d/environment';

type BootWindow = Window & { __heroAdventureBootReady?: boolean };
const MENU_CAMERA_TRANSITION_MS = 2500;
type SceneRegion = 'forest' | 'dungeon';
type OnboardingPhase = 'intro_camp' | 'post_first_hunt' | 'inventory_prompt' | 'inventory_unlocked' | 'cards_prompt' | 'cards_unlocked' | 'merchant_prompt' | 'merchant_unlocked' | 'items_prompt' | 'flee_prompt' | 'flee_unlocked' | 'dungeon_prompt' | 'dungeon_unlocked' | 'alchemist_prompt' | 'alchemist_unlocked';

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

interface BattleSettings {
    musicEnabled: boolean;
    sfxEnabled: boolean;
    renderQualityPreset: RenderQualityPreset;
}

const createDefaultBattleSettings = (): BattleSettings => ({
    musicEnabled: true,
    sfxEnabled: true,
    renderQualityPreset: getDefaultRenderQualityPreset(),
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
        return {
            musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : defaults.musicEnabled,
            sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : defaults.sfxEnabled,
            renderQualityPreset: sanitizeRenderQualityPreset(parsed.renderQualityPreset) ?? defaults.renderQualityPreset,
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
                    manaCost: 10 + (cycleStrength * 2),
                    cooldown: 2,
                    currentCooldown: 0,
                });
            }
            if (hasTier2Skill) {
                skills.push({
                    id: 'enemy_mage_dark_mend',
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
    const [player, setPlayer] = useState<Player>(() => clonePlayer(INITIAL_PLAYER));
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [enemyIntentPreview, setEnemyIntentPreview] = useState<EnemyIntentPreview | null>(null);
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [narration, setNarration] = useState<string>("");
  
  const [stage, setStage] = useState(1);
  const [killCount, setKillCount] = useState(0); // Track kills in current stage
  const [subBossDefeatedInStage, setSubBossDefeatedInStage] = useState(false);
    const [dungeonEvolution, setDungeonEvolution] = useState(0);
    const [dungeonSubBossDefeatedEvolution, setDungeonSubBossDefeatedEvolution] = useState<number | null>(null);

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
    const [levelUpModal, setLevelUpModal] = useState<{ levelsGained: number; nextLevel: number } | null>(null);
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
    const huntEnemyBagRef = useRef<EnemyTemplate[]>([]);
    const dungeonEnemyBagRef = useRef<DungeonEnemyTemplate[]>([]);
    const [sceneRegion, setSceneRegion] = useState<SceneRegion>('forest');
    const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>('intro_camp');
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

    const handleMenuHeroClick = useCallback(() => {
        if (menuHeroActionResetTimerRef.current !== null) {
            window.clearTimeout(menuHeroActionResetTimerRef.current);
            menuHeroActionResetTimerRef.current = null;
        }

        setMenuHeroAction('item');
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
        subBossDefeatedInStage,
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
        subBossDefeatedInStage,
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
        setSubBossDefeatedInStage(payload.subBossDefeatedInStage ?? false);
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
            subBossDefeatedInStage: payload.subBossDefeatedInStage ?? false,
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

  const addLog = (message: string, type: BattleLog['type'] = 'info') => {
    setLogs(prev => [{ message, type }, ...prev]);
  };

    const spawnEnemy = async (currentStage: number, isBoss: boolean, mode: 'hunt' | 'dungeon' = dungeonRun ? 'dungeon' : 'hunt', dungeonEvolutionOverride?: number) => {
    // Scale stats based on stage
    let levelMult = getStagePowerMultiplier(currentStage);
    const isDungeonEncounter = mode === 'dungeon';
    const activeDungeonEvolution = dungeonEvolutionOverride ?? dungeonRun?.evolution ?? dungeonEvolution;
    if (isDungeonEncounter) {
    levelMult *= getDungeonPowerMultiplier(activeDungeonEvolution);
    }
    const dungeonClearedInCurrentPhase = dungeonRun?.rewards.clearedMonsters ?? 0;
    const isHuntSubBossEncounter = !isDungeonEncounter && !isBoss && !subBossDefeatedInStage && (killCount + 1 === 5);
    const isDungeonSubBossEncounter = isDungeonEncounter
        && !isBoss
        && !dungeonRun?.rewards.subBossDefeatedInPhase
        && (dungeonClearedInCurrentPhase + 1 === 5);
    const isSubBossEncounter = isHuntSubBossEncounter || isDungeonSubBossEncounter;
    if (isSubBossEncounter) {
        levelMult *= 1.18;
    }
    if (isBoss) levelMult *= (isDungeonEncounter ? 2.1 : 1.9); // Boss scaling tuned by mode

    const availableDungeonEnemies = DUNGEON_ENEMY_DATA.filter(template => template.minEvolution <= activeDungeonEvolution);
    const dungeonEnemyPool = availableDungeonEnemies.length > 0 ? availableDungeonEnemies : DUNGEON_ENEMY_DATA;
    const enemyTemplate: EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate = isBoss
        ? (isDungeonEncounter ? DUNGEON_BOSS : pickFromEnemyBag(ENEMY_DATA, huntEnemyBagRef))
        : (isDungeonEncounter ? pickFromEnemyBag(dungeonEnemyPool, dungeonEnemyBagRef) : pickFromEnemyBag(ENEMY_DATA, huntEnemyBagRef));
    const enemyClassId = pickEnemyClassId(enemyTemplate);
    const templateBaseStats = enemyTemplate.baseStats;
    const baseHp = templateBaseStats?.maxHp ?? templateBaseStats?.hp ?? 68;
    const baseMp = templateBaseStats?.maxMp ?? templateBaseStats?.mp;
    const baseAtk = templateBaseStats?.atk ?? 9;
    const baseMagic = templateBaseStats?.magic ?? 8;
    const baseDef = templateBaseStats?.def ?? 3;
    const baseSpeed = templateBaseStats?.speed ?? 10;
    const baseLuck = templateBaseStats?.luck;
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
                : (isSubBossEncounter ? `Subchefe ${enemyTemplate.name}` : enemyTemplate.name);

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
            speed: baseSpeed + speedBonus + (isDungeonEncounter ? Math.floor(activeDungeonEvolution / 3) : 0) + (isSubBossEncounter ? 2 : 0),
        luck: baseLuck !== undefined
            ? Math.max(1, Math.floor(baseLuck + (isBoss ? 3 : 0) + (isSubBossEncounter ? 3 : 0) + (isDungeonEncounter ? activeDungeonEvolution * 0.35 : 0)))
            : Math.max(1, Math.floor((currentStage * 0.55) + (isBoss ? 3 : 0) + (isSubBossEncounter ? 3 : 0) + (isDungeonEncounter ? activeDungeonEvolution * 0.35 : 0)))
      },
            xpReward,
            goldReward,
                        color: isBoss ? (isDungeonEncounter ? DUNGEON_BOSS.color : '#ef4444') : (isSubBossEncounter ? '#d97706' : (enemyTemplate.color ?? color)),
                        scale: isBoss ? (isDungeonEncounter ? DUNGEON_BOSS.scale : (0.8 + (Math.random() * 0.4)) * 2.0) : ((enemyTemplate.scale ?? (0.8 + (Math.random() * 0.4))) * (isSubBossEncounter ? 1.16 : 1)),
      type: enemyTemplate.type as 'beast' | 'humanoid' | 'undead',
      enemyClassId,
      isBoss,
      isSubBoss: isSubBossEncounter,
            isDefending: false,
            impulso: 0,
            impulseGuardLevel: 0,
            statusEffects: [],
                assets: enemyTemplate.assets,
      attackStyle: enemyTemplate.attackStyle,
            guaranteedDrops: templateCombatProfile.guaranteedDrops,
            rareDrops: templateCombatProfile.rareDrops,
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
    setSubBossDefeatedInStage(false);
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
                subBossDefeatedInStage: false,
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

  const enterBattleImmediate = (isBoss: boolean, mode: 'hunt' | 'dungeon' = dungeonRun ? 'dungeon' : 'hunt', dungeonClearedOverride?: number) => {
            const isDungeonBattle = mode === 'dungeon';
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
    setSubBossDefeatedInStage,
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
                setTurnState(TurnState.PLAYER_INPUT);
            }
    }
    }, [addLog, enemy, gameState, handleEnemyTurn, setEnemyAnimationAction, setIsEnemyAttacking, turnState]);

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
    const isInventoryUnlocked = onboardingPhase === 'inventory_unlocked' || onboardingPhase === 'cards_prompt' || onboardingPhase === 'cards_unlocked' || onboardingPhase === 'merchant_prompt' || onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isCardsUnlocked = onboardingPhase === 'cards_prompt' || onboardingPhase === 'cards_unlocked' || onboardingPhase === 'merchant_prompt' || onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isItemsActionUnlocked = onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isFleeUnlocked = onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isSkillsActionUnlocked = skillsActionUnlocked;
    const isMerchantUnlocked = onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked' || onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isDungeonUnlocked = onboardingPhase === 'dungeon_prompt' || onboardingPhase === 'dungeon_unlocked' || onboardingPhase === 'alchemist_prompt' || onboardingPhase === 'alchemist_unlocked';
    const isAlchemistUnlocked = onboardingPhase === 'alchemist_unlocked';
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
                    if (!isContextReady) {
                        console.warn('[Audio] Contexto ainda bloqueado; aguardando nova interacao do usuario.');
                        return;
                    }

                    battleSfx.preload();
                    uiSfx.preload();

                    if (targetMusicTrack && battleSettings.musicEnabled) {
                        // iOS exige uma tentativa de play imediatamente apos o gesto para liberar BGM no PWA.
                        gameMusicManager.transitionTo(targetMusicTrack, 0);
                    }

                    setHasUnlockedMusic(true);
                } catch (error) {
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

        const recoverAudio = () => {
            if (document.visibilityState === 'hidden') {
                return;
            }

            const ensureRecovered = async () => {
                const unlockResults = await Promise.allSettled([gameMusicManager.unlock(), battleSfx.unlock(), uiSfx.unlock()]);
                const isContextReady = unlockResults.some((result) => result.status === 'fulfilled' && result.value);

                if (!isContextReady) {
                    return;
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

        recoverAudio();

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
                        isMenuView={resolvedGameState === GameState.TAVERN}
                        menuCameraFocus={shouldMenuCameraFocus}
                        isDungeonScene={sceneRegion === 'dungeon'}
                        renderQualityPreset={battleSettings.renderQualityPreset}
                        onMenuHeroClick={resolvedGameState === GameState.TAVERN ? handleMenuHeroClick : undefined}
                    />
            </SceneErrorBoundary>

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
            onAttack={handlePlayerAttack}
            onDefend={handlePlayerDefense}
            onChargeImpulse={handleChargeImpulse}
            onAbsorbImpulse={handleAbsorbImpulse}
            onSkill={handleSkill}
            onUseItem={handleUseItem}
            enemyIntentPreview={enemyIntentPreview}
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

      {lootResult && <KillLootOverlay loot={lootResult} />}
    </div>
  );
}




