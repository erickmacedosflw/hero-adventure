
import React, { useState, useEffect, useRef } from 'react';
import { Player, Enemy, EnemyIntentPreview, BattleLog, TurnState, Item, Skill, GameState, FloatingText, Rarity, ProgressionCard, CardRewardOffer, AlchemistCardOffer, AlchemistItemOffer, DungeonResult, DungeonRewards, BossVictoryContext } from '../types';
import { Sword, Shield, Zap, Heart, Coins, ShoppingBag, Skull, Play, Plus, FlaskConical, User, X, Home, LogOut, DollarSign, AlertTriangle, MousePointerClick, Shirt, Footprints, Crown, LayoutGrid, Sparkles, Crosshair, ArrowLeft, Star, Clock, Orbit } from 'lucide-react';
import { ItemPreviewThree } from './items/ItemPreviewThree';
import { GameAssetIcon } from './ui/game-asset-icon';
import { CharacterSheetModal } from './profile/CharacterSheetModal';
import { InventoryScreen as InventoryModal } from './profile/InventoryScreen';
import { ShopMenuScreen } from './shop/ShopMenuScreen';
import { ALL_ITEMS, SKILLS } from '../constants';
import { ALL_CARDS } from '../game/data/cards';
import { getPlayerClassById } from '../game/data/classes';
import { getTalentBonuses } from '../game/mechanics/classProgression';
import { shouldUseBowBasicAttack, shouldUseMagicBasicAttack } from '../game/mechanics/weaponProficiency';
import { getNewlyUnlockedShopRarityByStage } from '../game/mechanics/shopProgression';
import { uiSfx } from '../game/audio/uiSfx';
import type { RenderQualityPreset } from './scene3d/environment';

interface GameUIProps {
  player: Player;
  enemy: Enemy | null;
  gameState: GameState;
  turnState: TurnState;
  logs: BattleLog[];
  onAttack: () => void;
  onDefend: () => void;
  onChargeImpulse: () => void;
  onAbsorbImpulse: () => void;
  onSkill: (skill: Skill) => void;
  onUseItem: (itemId: string) => void;
  enemyIntentPreview?: EnemyIntentPreview | null;
  onUnlockTalent: (nodeId: string) => void;
  onResetTalents: () => void;
  onStartBattle: (isBoss: boolean) => void;
  onEnterShop: () => void;
  onBuyItem: (item: Item) => void;
    onSellItem: (item: Item, quantity?: number) => void;
  onEquipItem: (item: Item) => void;
  onUnequipItem: (item: Item) => void;
  onContinue: () => void; // Used for Level Up or Victory -> Tavern
  onFlee: () => void;
  currentNarration: string;
  shopItems: Item[];
  floatingTexts?: FloatingText[];
  stage: number;
  dungeonPhase?: number;
  killCount: number;
    isDungeonRun?: boolean;
    dungeonRewards?: DungeonRewards | null;
    dungeonCleared?: number;
    dungeonTotal?: number;
    gameTime?: string;
    restrictProfileToStatusOnly?: boolean;
    limitBattleActionsToBasics?: boolean;
    inventoryUnlocked?: boolean;
    inventoryUnlockPromptActive?: boolean;
    onAcknowledgeInventoryUnlock?: () => void;
    cardsUnlockPromptActive?: boolean;
    onAcknowledgeCardsUnlock?: () => void;
    skillsUnlockPromptActive?: boolean;
    onAcknowledgeSkillsUnlock?: () => void;
    impulseUnlockPromptActive?: number | null;
    onAcknowledgeImpulseUnlock?: () => void;
    constellationUnlockPromptActive?: boolean;
    onAcknowledgeConstellationUnlock?: () => void;
    constellationRespecUnlockPromptActive?: boolean;
    onAcknowledgeConstellationRespecUnlock?: () => void;
    allowCardsInProfile?: boolean;
    fleeUnlocked?: boolean;
    showItemsAction?: boolean;
    showSkillsAction?: boolean;
    itemsUnlockPromptActive?: boolean;
    onAcknowledgeItemsUnlock?: () => void;
    fleeUnlockPromptActive?: boolean;
    onAcknowledgeFleeUnlock?: () => void;
    showDiamondHud?: boolean;
    diamondUnlockPromptActive?: boolean;
    onAcknowledgeDiamondUnlock?: () => void;
    musicEnabled?: boolean;
    sfxEnabled?: boolean;
    renderQualityPreset?: RenderQualityPreset;
    recommendedRenderQualityPreset?: RenderQualityPreset;
    onUpdateBattleSettings?: (partial: Partial<{
        musicEnabled: boolean;
        sfxEnabled: boolean;
        renderQualityPreset: RenderQualityPreset;
    }>) => void;
}

// --- HELPERS ---
const getRarityColor = (rarity: Rarity) => {
    switch(rarity) {
        case 'bronze': return 'border-orange-700/50 text-orange-100 bg-gradient-to-r from-orange-900/20 to-transparent';
        case 'silver': return 'border-slate-400/50 text-slate-100 bg-gradient-to-r from-slate-800/50 to-transparent';
        case 'gold': return 'border-amber-400 text-amber-100 bg-gradient-to-r from-amber-900/40 to-transparent shadow-[inset_0_0_20px_rgba(251,191,36,0.1)]';
        default: return 'border-slate-700 text-white';
    }
}

const getImpulseCapacityByLevel = (level: number) => (
    level >= 12 ? 3 : level >= 8 ? 2 : level >= 4 ? 1 : 0
);

const ItemTypeIcon = ({ type, size = 14 }: { type: Item['type'], size?: number }) => {
    if (type === 'weapon') return <Sword size={size} />;
    if (type === 'shield') return <Shield size={size} />;
    if (type === 'helmet') return <Crown size={size} />;
    if (type === 'armor') return <Shirt size={size} />;
    if (type === 'legs') return <Footprints size={size} />;
    if (type === 'potion') return <FlaskConical size={size} />;
    return <Sparkles size={size} />;
};

const ItemTypeLabel = ({ type }: { type: Item['type'] }) => {
    if (type === 'weapon') return <>Arma</>;
    if (type === 'shield') return <>Escudo</>;
    if (type === 'helmet') return <>Capacete</>;
    if (type === 'armor') return <>Armadura</>;
    if (type === 'legs') return <>Pernas</>;
    if (type === 'potion') return <>Consumivel</>;
    return <>Material</>;
};

const getCardCategoryMeta = (card: ProgressionCard) => {
    if (card.category === 'economia') return { label: 'Economia', tone: 'text-amber-200 bg-amber-500/10 border-amber-400/20' };
    if (card.category === 'atributo') return { label: 'Atributo', tone: 'text-emerald-200 bg-emerald-500/10 border-emerald-400/20' };
    if (card.category === 'batalha') return { label: 'Combate', tone: 'text-rose-200 bg-rose-500/10 border-rose-400/20' };
    return { label: 'Especial', tone: 'text-sky-200 bg-sky-500/10 border-sky-400/20' };
};

const getCardRarityLabel = (rarity: Rarity) => {
    if (rarity === 'bronze') return 'Comum';
    if (rarity === 'silver') return 'Rara';
    return 'Lendaria';
};

const darkenHexColor = (hex: string, amount = 0.2): string => {
    const normalized = hex.trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return hex;
    }

    const toChannel = (start: number) => parseInt(normalized.slice(start, start + 2), 16);
    const darken = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * (1 - amount))));
    const toHex = (value: number) => value.toString(16).padStart(2, '0');

    const r = darken(toChannel(0));
    const g = darken(toChannel(2));
    const b = darken(toChannel(4));
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const HERO_CLASS_ICON: Record<Player['classId'], React.ComponentType<{ size?: number; className?: string }>> = {
    knight: Shield,
    barbarian: Sword,
    mage: Sparkles,
    ranger: Crosshair,
    rogue: Zap,
};

const CLASS_NAME_PT: Record<Player['classId'], string> = {
    knight: 'Cavaleiro',
    barbarian: 'Barbaro',
    mage: 'Mago',
    ranger: 'Arqueiro',
    rogue: 'Ladino',
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

const CARD_PERCENT_BY_RARITY: Record<Rarity, number> = {
    bronze: 0.04,
    silver: 0.05,
    gold: 0.07,
};

const OPENING_COMBAT_BOOST_BY_RARITY: Record<Rarity, number> = {
    bronze: 0.1,
    silver: 0.15,
    gold: 0.2,
};

const getScaledCardEffectValue = (card: ProgressionCard, effect: ProgressionCard['effects'][number]) => {
    if (effect.type === 'opening_atk_buff' || effect.type === 'opening_def_buff') {
        return OPENING_COMBAT_BOOST_BY_RARITY[card.rarity];
    }
    if (PERCENT_CARD_EFFECT_TYPES.has(effect.type)) {
        return CARD_PERCENT_BY_RARITY[card.rarity];
    }
    return effect.value;
};

const getCardEffectPreview = (card: ProgressionCard) => {
    const unlockEffect = card.effects.find(effect => effect.type === 'unlock_skill');
    if (unlockEffect?.skillId) {
        const skill = SKILLS.find(entry => entry.id === unlockEffect.skillId);
        return skill ? `Libera ${skill.name}` : 'Libera habilidade';
    }

    const primaryEffect = card.effects[0];
    if (!primaryEffect) {
        return card.description;
    }

    const primaryValue = getScaledCardEffectValue(card, primaryEffect);
    const value = Number.isInteger(primaryValue)
        ? primaryValue.toString()
        : `${Math.round(primaryValue * 100)}%`;

    switch (primaryEffect.type) {
        case 'gold_instant': return `+${value} ouro`;
        case 'xp_instant': return `+${value} XP`;
        case 'max_hp': return `+${value} vida máxima`;
        case 'max_mp': return `+${value} mana máxima`;
        case 'atk': return `+${value} ataque`;
        case 'magic': return `+${value} magia`;
        case 'def': return `+${value} defesa`;
        case 'speed': return `+${value} velocidade`;
        case 'luck': return `+${value} sorte`;
        case 'gold_gain_multiplier': return `+${value} ouro por batalha`;
        case 'xp_gain_multiplier': return `+${value} XP por batalha`;
        case 'boss_damage_multiplier': return `+${value} dano em chefes`;
        case 'heal_multiplier': return `+${value} cura`;
        case 'opening_atk_buff': return `+${value} ataque inicial`;
        case 'opening_def_buff': return `+${value} defesa inicial`;
        case 'defend_mana_restore': return `+${value} mana ao defender`;
        case 'counter_attack_chance_bonus': return `+${value} contra-ataque`;
        case 'opening_counter_attack_boost': return `+${value} contra no inicio`;
        case 'hp_regen_per_turn': return `+${value} HP por turno`;
        case 'mp_regen_per_turn': return `+${value} MP por turno`;
        default: return card.description;
    }
};

const HeaderChip = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="game-surface rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-bold tracking-wide text-slate-100">
        <span className="game-icon-badge w-6 h-6">{icon}</span>
        <span>{children}</span>
    </div>
);

const MENU_MODAL_ANIM_MS = 220;

const getRenderPresetLabel = (preset: RenderQualityPreset) => {
    if (preset === 'performance') return 'Performance';
    if (preset === 'quality') return 'Qualidade';
    return 'Balanceado';
};

const AnimatedModal = ({
    open,
    children,
}: {
    open: boolean;
    children: (isClosing: boolean) => React.ReactNode;
}) => {
    const [shouldRender, setShouldRender] = useState(open);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (open) {
            setShouldRender(true);
            setIsClosing(false);
            return;
        }

        if (!shouldRender) {
            return;
        }

        setIsClosing(true);
        const timer = window.setTimeout(() => {
            setShouldRender(false);
            setIsClosing(false);
        }, MENU_MODAL_ANIM_MS);

        return () => window.clearTimeout(timer);
    }, [open, shouldRender]);

    if (!shouldRender) {
        return null;
    }

    return <>{children(isClosing)}</>;
};

const ActionTile = ({
  icon,
  label,
  disabled,
  onClick,
  variant,
  glowColor,
  forceClassName,
  forceStyle,
  glowStrength = 16,
  energized = false,
  sparkleColor = '#ffffff',
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  variant: 'attack' | 'defense' | 'item' | 'neutral' | 'danger' | 'skill';
  glowColor?: string;
  forceClassName?: string;
  forceStyle?: React.CSSProperties;
  glowStrength?: number;
  energized?: boolean;
  sparkleColor?: string;
}) => {
    const variantClass = {
        attack: 'bg-[#c44b54] border-[#a83a42] text-white hover:bg-[#b5424a] shadow-lg shadow-[#c44b54]/20',
        defense: 'bg-[#4d7a96] border-[#3b6580] text-white hover:bg-[#5a8aa6] shadow-lg shadow-[#4d7a96]/20',
        item: 'bg-[#b87a3a] border-[#9a6530] text-white hover:bg-[#c88a4a]',
        neutral: 'bg-[#f4e5d4] border-[#cfab91] text-[#6b3141] hover:bg-[#e9d7c2]',
        danger: 'bg-rose-500 border-rose-600 text-white hover:brightness-110',
        skill: 'bg-[#7c4c76] border-[#664060] text-white hover:bg-[#8d5d87] shadow-lg shadow-[#7c4c76]/20',
    }[variant];

    const tileStyle = !disabled
        ? {
            ...(forceStyle ?? {}),
            ...(glowColor ? { boxShadow: `0 0 0 1px ${glowColor}88, 0 0 ${glowStrength}px ${glowColor}88` } : {}),
        }
        : undefined;

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`relative overflow-hidden col-span-1 w-full rounded-[12px] sm:rounded-[14px] aspect-square flex flex-col items-center justify-center gap-1 sm:gap-1.5 border-b-2 sm:border-b-3 transition-all active:translate-y-0.5 active:border-b-0 ${disabled ? 'bg-[#e9d7c2] border-[#dcc0aa] text-[#8f6c67] cursor-not-allowed' : (forceClassName ?? variantClass)}`}
            style={tileStyle}
        >
            {energized && !disabled && (
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[12px] sm:rounded-[14px]">
                    <span className="absolute -left-1/4 top-1/2 h-8 w-[140%] -translate-y-1/2 rotate-[-16deg] blur-md animate-pulse" style={{ backgroundColor: `${sparkleColor}55` }} />
                    <span className="absolute left-[18%] top-[20%] h-1.5 w-1.5 rounded-full animate-ping" style={{ backgroundColor: sparkleColor }} />
                    <span className="absolute right-[18%] top-[30%] h-1 w-1 rounded-full animate-ping" style={{ backgroundColor: sparkleColor }} />
                    <span className="absolute left-[35%] bottom-[24%] h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: sparkleColor }} />
                    <span className="absolute right-[30%] bottom-[20%] h-1 w-1 rounded-full animate-pulse" style={{ backgroundColor: sparkleColor }} />
                </span>
            )}
            {icon}
            <span className="font-black text-[7px] sm:text-[11px] tracking-wide uppercase">{label}</span>
        </button>
    );
};

export const ProgressBar = ({ current, max, color, label }: { current: number, max: number, color: string, label?: string }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="w-full bg-gray-900 rounded-full h-4 mb-2 relative border border-gray-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ease-out ${color}`} style={{ width: `${percentage}%` }} />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-black drop-shadow-lg">
        {label && <span className="mr-1 opacity-75">{label}</span>} {current} / {max}
      </div>
    </div>
  );
};

// --- LOOT OVERLAY COMPONENT ---
interface LootResult {
    gold: number;
    xp: number;
    diamonds?: number;
    drops: Item[];
    isBoss: boolean;
    enemyName: string;
}

export const KillLootOverlay = ({ loot }: { loot: LootResult | null }) => {
    if (!loot) return null;
    return (
        <div
            className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none"
            style={{ animation: 'killLootIn 2.8s forwards ease-in-out' }}
        >
            <style>{`
                @keyframes killLootIn {
                    0%   { opacity: 0; transform: scale(0.8) translateY(30px); }
                    14%  { opacity: 1; transform: scale(1.04) translateY(-4px); }
                    22%  { opacity: 1; transform: scale(1) translateY(0); }
                    72%  { opacity: 1; transform: scale(1) translateY(0); }
                    100% { opacity: 0; transform: scale(0.92) translateY(-16px); }
                }
                @keyframes lootShimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes lootIconPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.12); }
                }
            `}</style>
            <div className={`rounded-[24px] shadow-2xl p-4 sm:p-6 text-center max-w-[280px] sm:max-w-sm w-full mx-3 backdrop-blur-md relative overflow-hidden
                ${loot.isBoss
                    ? 'bg-[#f7ecdd]/95 border-2 border-amber-500 shadow-[0_24px_80px_rgba(180,120,40,0.35)]'
                    : 'bg-[#f7ecdd]/95 border-2 border-[#cfab91] shadow-[0_24px_80px_rgba(107,49,65,0.25)]'
                }
            `}>
                {/* Decorative shimmer stripe */}
                <div className="absolute inset-0 pointer-events-none opacity-30"
                    style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(250,204,21,0.3) 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'lootShimmer 2.5s ease-in-out infinite',
                    }}
                />

                <div className="relative mb-3 sm:mb-4">
                    <div className="text-3xl sm:text-5xl mb-1.5" style={{ animation: 'lootIconPulse 1.2s ease-in-out infinite' }}>
                        {loot.isBoss ? '⚔️' : '🏆'}
                    </div>
                    <div className={`font-black text-sm sm:text-lg tracking-[0.18em] uppercase
                        ${loot.isBoss ? 'text-amber-700' : 'text-[#6b3141]'}
                    `}>
                        {loot.isBoss ? 'CHEFÃO DERROTADO!' : 'INIMIGO DERROTADO'}
                    </div>
                    <div className="text-[#9a7068] text-[10px] sm:text-xs mt-0.5 font-bold uppercase tracking-wider">{loot.enemyName}</div>
                </div>

                <div className="flex gap-1.5 sm:gap-2 justify-center mb-3 sm:mb-4 flex-wrap relative">
                    <div className="flex items-center gap-1.5 bg-[#f4e5d4] border border-[#d6b9a3] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[14px]">
                        <GameAssetIcon name="coin" size={18} />
                        <div className="text-left">
                            <div className="text-[8px] sm:text-[9px] text-[#9a7068] font-black uppercase tracking-wider">Ouro</div>
                            <div className="text-[#8d5e29] font-mono font-black text-sm sm:text-base">+{loot.gold}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#f4e5d4] border border-[#d6b9a3] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[14px]">
                        <span className="text-base sm:text-lg">⭐</span>
                        <div className="text-left">
                            <div className="text-[8px] sm:text-[9px] text-[#9a7068] font-black uppercase tracking-wider">XP</div>
                            <div className="text-[#7c4c76] font-mono font-black text-sm sm:text-base">+{loot.xp}</div>
                        </div>
                    </div>
                    {loot.diamonds && loot.diamonds > 0 && (
                        <div className="flex items-center gap-1.5 bg-[#f4e5d4] border border-[#d6b9a3] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[14px]">
                            <GameAssetIcon name="diamond" size={18} />
                            <div className="text-left">
                                <div className="text-[8px] sm:text-[9px] text-[#9a7068] font-black uppercase tracking-wider">Gema</div>
                                <div className="text-[#346c7f] font-mono font-black text-sm sm:text-base">+{loot.diamonds}</div>
                            </div>
                        </div>
                    )}
                </div>

                {loot.drops.length > 0 && (
                    <div className="relative border-t border-[#dcc0aa] pt-2.5 sm:pt-3">
                        <div className="text-[8px] sm:text-[9px] text-[#9a7068] uppercase tracking-[0.25em] mb-1.5 sm:mb-2 font-black">— Espólio —</div>
                        <div className="flex gap-1.5 justify-center flex-wrap">
                            {loot.drops.map((item, i) => (
                                <div key={i} className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-[10px] border text-[10px] sm:text-xs font-bold
                                    ${item.rarity === 'gold' ? 'bg-amber-50 border-amber-400 text-amber-800'
                                    : item.rarity === 'silver' ? 'bg-slate-50 border-slate-400 text-slate-700'
                                    : 'bg-[#f8eddf] border-[#d6b9a3] text-[#6b3141]'}
                                `}>
                                    <span className="text-sm sm:text-base">{item.icon}</span>
                                    <span>{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- FLOATING TEXT COMPONENT ---
const FloatingTextOverlay = ({ texts }: { texts: FloatingText[] }) => {
    const stackIndexes = (() => {
        const nextIndexes = { player: 0, enemy: 0 };
        const result: Record<string, number> = {};

        texts.forEach((text) => {
            result[text.id] = nextIndexes[text.target];
            nextIndexes[text.target] += 1;
        });

        return result;
    })();

    return (
        <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
            {texts.map(t => {
                const stackIndex = stackIndexes[t.id] ?? 0;
                const leftPos = t.target === 'player' ? '28%' : '72%';
                const topPos = t.target === 'player' ? '37%' : '33%';
                const isCrit = t.type === 'crit';
                const isBuff = t.type === 'buff';
                const isSkill = t.type === 'skill';
                const isItem = t.type === 'item';
                const verticalStackOffset = stackIndex * 56;
                const floatDurationMs = t.durationMs ?? (isSkill || isItem ? 2100 : isCrit ? 1500 : 1100);
                
                let colorClass = "text-white";
                if (t.type === 'damage') colorClass = "text-red-500";
                if (t.type === 'heal') colorClass = "text-green-400";
                if (isCrit) colorClass = "text-amber-400";
                if (isBuff) colorClass = "text-blue-400";
                if (isSkill) colorClass = "text-violet-400";
                if (isItem) colorClass = "text-yellow-300";
                const colorStyle = t.color
                    ? { color: t.color }
                    : isSkill
                      ? { color: '#d946ef' }
                      : isItem
                        ? { color: '#facc15' }
                        : undefined;

                return (
                    <div 
                        key={t.id}
                        className={`absolute whitespace-nowrap leading-none font-black ${colorClass} drop-shadow-[0_2px_2px_rgba(0,0,0,1)] inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur-[2px]`}
                        style={{
                            left: `calc(${leftPos} + ${Math.round(t.xOffset * 0.22)}px)`,
                            top: `calc(${topPos} + ${Math.round(t.yOffset * 0.12) + verticalStackOffset}px)`,
                            fontSize: isCrit
                                ? 'clamp(2.45rem, 9vw, 2.9rem)'
                                : isBuff
                                  ? 'clamp(1.75rem, 7.2vw, 2.2rem)'
                                  : isSkill
                                    ? 'clamp(1.35rem, 5.8vw, 1.7rem)'
                                    : isItem
                                      ? 'clamp(1.25rem, 5.2vw, 1.55rem)'
                                  : 'clamp(2.2rem, 8.8vw, 2.7rem)',
                            minWidth: isCrit ? '8.1rem' : '6.8rem',
                            animation: `floatUp ${floatDurationMs}ms forwards ease-out`,
                            zIndex: isSkill || isItem ? 130 : 100,
                            ...colorStyle
                        }}
                    >
                        <style>{`
                            @keyframes floatUp {
                                0% { transform: translate(-50%, 0) scale(0.72); opacity: 0; }
                                18% { transform: translate(-50%, -10px) scale(1.04); opacity: 1; }
                                100% { transform: translate(-50%, -42px) scale(1); opacity: 0; }
                            }
                        `}</style>
                        {t.text}
                    </div>
                )
            })}
        </div>
    )
}

// --- COMPONENT: CHARACTER SHEET ---
const InventoryScreen = ({ player, shopItems, onClose, onEquip, onUse }: { player: Player, shopItems: Item[], onClose: () => void, onEquip: (item: Item) => void, onUse: (itemId: string) => void }) => {
    const [filter, setFilter] = useState<'all' | 'equipment' | 'potion' | 'material'>('all');
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [mobileDetailItem, setMobileDetailItem] = useState<Item | null>(null);

    const inventoryItems = Object.entries(player.inventory)
        .filter(([id, qty]) => qty > 0)
        .map(([id, qty]) => {
            const itemDef = shopItems.find(i => i.id === id);
            return { item: itemDef, qty };
        })
        .filter(i => i.item !== undefined) as { item: Item, qty: number }[];

    const filteredItems = inventoryItems.filter(({ item }) => {
        if (filter === 'all') return true;
        if (filter === 'equipment') return ['weapon', 'armor', 'helmet', 'legs', 'shield'].includes(item.type);
        return item.type === filter;
    });

    const inventoryKeys = Object.entries(player.inventory).filter(([_, q]) => q > 0).map(([id]) => id).sort().join(',');

    useEffect(() => {
        if (filteredItems.length > 0 && (!selectedItem || !filteredItems.find(i => i.item.id === selectedItem.id))) {
            setSelectedItem(filteredItems[0].item);
        } else if (filteredItems.length === 0) {
            setSelectedItem(null);
        }
    }, [filter, inventoryKeys]);

    const handleAction = (item: Item) => {
        if (item.type === 'potion') {
            onUse(item.id);
        } else if (item.type !== 'material') {
            onEquip(item);
        }
    };

    return (
        <div className="absolute inset-0 z-[70] bg-slate-950 text-white flex flex-col pointer-events-auto animate-fade-in-down">
            <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-lg z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="game-icon-badge w-10 h-10 text-emerald-400"><ShoppingBag /></div>
                    <div>
                        <h2 className="font-bold text-xl text-emerald-100">Mochila</h2>
                        <p className="text-xs text-slate-500">Gerencie seus itens e equipamentos.</p>
                    </div>
                </div>
                <button onClick={onClose} className="bg-slate-800 p-2 rounded hover:bg-red-600 hover:text-white transition-colors cursor-pointer">
                    <X size={24} />
                </button>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: ITEMS LIST + FILTERS (full-width on mobile) */}
                <div className="w-full md:w-80 lg:w-96 bg-slate-900 md:border-r border-slate-800 flex flex-col shrink-0">
                    <div className="p-3 border-b border-slate-800 bg-slate-950/50">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Filtrar por</h3>
                        <div className="flex flex-wrap gap-1">
                            {[
                                { id: 'all', label: 'Todos', icon: <LayoutGrid size={16} /> },
                                { id: 'equipment', label: 'Equip.', icon: <Shield size={16} /> },
                                { id: 'potion', label: 'Consum.', icon: <FlaskConical size={16} /> },
                                { id: 'material', label: 'Materiais', icon: <Sparkles size={16} /> }
                            ].map(f => (
                                <button 
                                    key={f.id}
                                    onClick={() => setFilter(f.id as any)} 
                                    className={`p-2 rounded flex items-center gap-2 text-xs font-bold flex-grow justify-center transition-colors
                                        ${filter === f.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
                                    `}
                                >
                                    {f.icon} {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {filteredItems.length === 0 ? (
                            <div className="text-center p-8 text-slate-600 italic border border-dashed border-slate-800 rounded-lg">
                                Nenhum item encontrado.
                            </div>
                        ) : (
                            filteredItems.map(({ item, qty }) => {
                                const isSelected = selectedItem?.id === item.id;
                                const rarityClass = getRarityColor(item.rarity);
                                return (
                                    <button 
                                        key={item.id}
                                        onClick={() => { setSelectedItem(item); setMobileDetailItem(item); }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left group
                                            ${isSelected ? 'bg-slate-800 shadow-lg scale-[1.02] z-10' : 'bg-slate-900/50 hover:bg-slate-800'}
                                            ${rarityClass}
                                        `}
                                    >
                                        <div className="w-12 h-12 bg-slate-950 rounded-lg border border-slate-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform relative">
                                            <span className="text-2xl leading-none select-none">{item.icon}</span>
                                            <span className="absolute -bottom-0.5 -right-0.5 game-icon-badge w-4 h-4 text-cyan-400"><ItemTypeIcon type={item.type} size={8} /></span>
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-bold text-sm truncate text-slate-200 group-hover:text-white">{item.name}</div>
                                            <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                                <ItemTypeLabel type={item.type} />
                                            </div>
                                        </div>
                                        <div className="bg-black/40 px-2 py-1 rounded text-white font-mono font-bold text-xs">
                                            x{qty}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT: ITEM DETAILS (desktop only) */}
                <div className="flex-1 bg-slate-950 hidden md:flex flex-col items-center justify-center p-8 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-slate-950" />
                    
                    {selectedItem ? (
                        <div className="z-10 w-full max-w-md flex flex-col items-center animate-fade-in-down">
                                <div className="w-full max-w-[28rem] h-[24rem] mb-6 relative rounded-[1.75rem] overflow-hidden border border-emerald-400/20 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] panel-glow">
                                    <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
                                    <div className="absolute left-4 top-4 z-0 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300/80">3D Preview</div>
                                    <div className="absolute inset-x-8 bottom-6 z-0 h-8 rounded-full bg-emerald-500/10 blur-2xl" />
                                    <div className="absolute inset-0 z-10">
                                        <ItemPreviewThree item={selectedItem} />
                                    </div>
                            </div>
                            
                            <h2 className="text-3xl font-black text-white mb-2 text-center">{selectedItem.name}</h2>
                            <div className="flex gap-2 mb-6">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest border ${getRarityColor(selectedItem.rarity)}`}>
                                    {selectedItem.rarity}
                                </span>
                                <span className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest bg-slate-800 text-slate-300 border border-slate-700">
                                    {selectedItem.type}
                                </span>
                            </div>

                            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl w-full backdrop-blur-sm mb-6">
                                <p className="text-slate-400 text-sm text-center mb-6 italic">"{selectedItem.description}"</p>
                                
                                {selectedItem.type !== 'material' && (
                                    <div className="flex justify-center items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                                        <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Poder</span>
                                        <span className="text-2xl font-black text-emerald-400">+{selectedItem.value}</span>
                                        <span className="text-slate-500 text-xs">{selectedItem.type === 'weapon' ? 'ATK' : selectedItem.type === 'potion' ? 'RECUPERAÇÃO' : 'DEF'}</span>
                                    </div>
                                )}
                            </div>

                            {selectedItem.type !== 'material' && (
                                <button 
                                    onClick={() => handleAction(selectedItem)}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                                >
                                    {selectedItem.type === 'potion' ? <><FlaskConical /> USAR ITEM</> : <><Shield /> EQUIPAR</>}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="z-10 text-slate-600 flex flex-col items-center gap-4">
                            <ShoppingBag size={64} className="opacity-20" />
                            <p className="font-bold tracking-widest uppercase">Selecione um item</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MOBILE: Item Detail Overlay */}
            {mobileDetailItem && (
                <div className="absolute inset-0 z-30 bg-slate-950/98 backdrop-blur flex flex-col md:hidden pointer-events-auto animate-fade-in-down">
                    <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 shrink-0">
                        <h3 className="font-bold text-sm text-emerald-200 flex items-center gap-2"><ArrowLeft size={16} /> Detalhes do Item</h3>
                        <button onClick={() => setMobileDetailItem(null)} className="bg-slate-800 p-2 rounded hover:bg-red-600 hover:text-white transition-colors cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center gap-4">
                        <div className="w-full max-w-[20rem] h-[16rem] relative rounded-2xl overflow-hidden border border-emerald-400/20 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] panel-glow">
                            <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
                            <div className="absolute inset-0 z-10">
                                <ItemPreviewThree item={mobileDetailItem} />
                            </div>
                        </div>
                        
                        <h2 className="text-2xl font-black text-white text-center">{mobileDetailItem.name}</h2>
                        <div className="flex gap-2">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest border ${getRarityColor(mobileDetailItem.rarity)}`}>
                                {mobileDetailItem.rarity}
                            </span>
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest bg-slate-800 text-slate-300 border border-slate-700">
                                {mobileDetailItem.type}
                            </span>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl w-full">
                            <p className="text-slate-400 text-sm text-center mb-4 italic">"{mobileDetailItem.description}"</p>
                            {mobileDetailItem.type !== 'material' && (
                                <div className="flex justify-center items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Poder</span>
                                    <span className="text-xl font-black text-emerald-400">+{mobileDetailItem.value}</span>
                                    <span className="text-slate-500 text-[10px]">{mobileDetailItem.type === 'weapon' ? 'ATK' : mobileDetailItem.type === 'potion' ? 'RECUPERAÇÃO' : 'DEF'}</span>
                                </div>
                            )}
                        </div>

                        {mobileDetailItem.type !== 'material' && (
                            <button 
                                onClick={() => { handleAction(mobileDetailItem); setMobileDetailItem(null); }}
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2"
                            >
                                {mobileDetailItem.type === 'potion' ? <><FlaskConical size={18} /> USAR ITEM</> : <><Shield size={18} /> EQUIPAR</>}
                            </button>
                        )}
                        <button 
                            onClick={() => setMobileDetailItem(null)}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700 transition-colors"
                        >
                            Voltar para a lista
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CharacterSheet = ({ player, shopItems, onClose, onOpenInventory }: { player: Player, shopItems: Item[], onClose: () => void, onOpenInventory: () => void }) => {
    const slots: Array<{ label: string; item: Item | null; type: Item['type'] }> = [
            { label: "Arma", item: player.equippedWeapon, type: 'weapon' },
            { label: "Escudo", item: player.equippedShield, type: 'shield' },
            { label: "Capacete", item: player.equippedHelmet, type: 'helmet' },
            { label: "Armadura", item: player.equippedArmor, type: 'armor' },
            { label: "Pernas", item: player.equippedLegs, type: 'legs' },
    ];

    const selectedCards = Object.entries(
        player.chosenCards.reduce<Record<string, number>>((accumulator, cardId) => {
            accumulator[cardId] = (accumulator[cardId] || 0) + 1;
            return accumulator;
        }, {})
    )
        .map(([cardId, count]) => ({
            card: ALL_CARDS.find(entry => entry.id === cardId),
            count,
        }))
        .filter((entry): entry is { card: ProgressionCard; count: number } => Boolean(entry.card))
        .sort((left, right) => {
            if (right.count !== left.count) {
                return right.count - left.count;
            }

            const rarityWeight = { bronze: 1, silver: 2, gold: 3 };
            const rarityDifference = rarityWeight[right.card.rarity] - rarityWeight[left.card.rarity];
            if (rarityDifference !== 0) {
                return rarityDifference;
            }

            return left.card.name.localeCompare(right.card.name);
        });

    const repeatedStacks = selectedCards.filter(entry => entry.count > 1).length;
    const totalCardPicks = player.chosenCards.length;

  return (
  <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto" onClick={onClose}>
     <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-6xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative animate-fade-in-down" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
           <div className="flex-1">
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                  <User className="w-8 h-8 text-indigo-400" />
                  {player.name}
              </h2>
              <div className="mt-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700 max-w-md">
                  <div className="flex justify-between text-sm text-slate-300 mb-1">
                      <span>Nível {player.level}</span>
                      <span>{player.xp} / {player.xpToNext} XP</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all duration-500" style={{width: `${(player.xp/player.xpToNext)*100}%`}} />
                  </div>
              </div>
           </div>
           <button onClick={onClose} className="bg-slate-800 p-2 rounded hover:bg-red-600 hover:text-white transition-colors ml-4 z-50 cursor-pointer">
               <X size={24} />
           </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {/* Left: Stats */}
           <div>
              <h3 className="font-bold text-amber-400 mb-3 border-b border-slate-700 pb-1 flex items-center gap-2"><Zap size={16}/> Atributos</h3>
              <div className="space-y-2 text-sm bg-slate-800/30 p-3 rounded-lg">
                 <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Força (ATK)</span> <span className="font-mono text-white text-amber-200">{player.stats.atk}</span></div>
                 <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Defesa (DEF)</span> <span className="font-mono text-white text-blue-200">{player.stats.def}</span></div>
                 <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Velocidade (SPD)</span> <span className="font-mono text-white text-green-200">{player.stats.speed}</span></div>
                 <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Sorte (LUCK)</span> <span className="font-mono text-white text-purple-200">{player.stats.luck}</span></div>
                 <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Vida Máx.</span> <span className="font-mono text-white text-red-200">{player.stats.maxHp}</span></div>
                 <div className="flex justify-between"><span>Mana Máx.</span> <span className="font-mono text-white text-blue-200">{player.stats.maxMp}</span></div>
              </div>
           </div>

           {/* Middle-Left: Equipment */}
           <div>
              <h3 className="font-bold text-indigo-400 mb-3 border-b border-slate-700 pb-1 flex items-center gap-2"><Shield size={16}/> Equipamento</h3>
              <div className="space-y-2">
                 {slots.map((slot, idx) => {
                     const rarityClass = slot.item ? getRarityColor(slot.item.rarity) : 'border-slate-700';
                     return (
                     <div key={idx} className={`bg-slate-800 p-2 rounded-lg flex items-center gap-3 border ${rarityClass} relative overflow-hidden h-16`}>
                        <div className="w-12 h-12 bg-slate-900 rounded border border-slate-700 flex items-center justify-center relative shrink-0">
                            {slot.item ? (
                                <>
                                    <span className="text-2xl leading-none select-none">{slot.item.icon}</span>
                                    <span className="absolute -bottom-0.5 -right-0.5 game-icon-badge w-4 h-4 text-cyan-400"><ItemTypeIcon type={slot.type} size={8} /></span>
                                </>
                            ) : (
                                <span className="text-slate-600 opacity-60"><ItemTypeIcon type={slot.type} size={16} /></span>
                            )}
                        </div>

                        <div className="flex-1 z-10">
                           <div className="text-[9px] uppercase tracking-wider text-slate-500">{slot.label}</div>
                           <div className="font-bold text-white text-sm truncate">{slot.item?.name || "Vazio"}</div>
                           {slot.item && <div className="text-[10px] text-indigo-300">+{slot.item.value} {slot.item.type === 'weapon' ? 'ATK' : (slot.item.type === 'legs' ? 'VEL' : 'DEF')}</div>}
                        </div>
                     </div>
                 )})}
              </div>
           </div>

           {/* Middle-Right: Skills */}
           <div>
              <h3 className="font-bold text-purple-400 mb-3 border-b border-slate-700 pb-1 flex items-center gap-2"><Sparkles size={16}/> Habilidades</h3>
              <div className="space-y-2 h-80 overflow-y-auto pr-2 custom-scrollbar">
                 {player.skills.length > 0 ? (
                   player.skills.map(skill => (
                     <div key={skill.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-colors group">
                        <div className="flex justify-between items-start mb-1">
                           <span className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">{skill.name}</span>
                           <span className="text-[9px] bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 font-mono font-bold">
                              {skill.manaCost} MP
                           </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{skill.description}</p>
                     </div>
                   ))
                 ) : (
                   <div className="text-center p-8 text-slate-600 italic border border-dashed border-slate-700 rounded-lg text-xs">
                             Nenhuma habilidade aprendida. Escolha cartas de habilidade para montar sua build.
                   </div>
                 )}
              </div>
           </div>

           {/* Right: Inventory */}
           <div>
              <h3 className="font-bold text-emerald-400 mb-3 border-b border-slate-700 pb-1 flex items-center gap-2"><ShoppingBag size={16}/> Mochila</h3>
              <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50 text-center flex flex-col items-center justify-center h-80">
                  <ShoppingBag size={48} className="text-emerald-500/50 mb-4" />
                  <p className="text-sm text-slate-400 mb-6">Gerencie seus itens, equipamentos e materiais.</p>
                  <button 
                      onClick={onOpenInventory}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg transition-all hover:-translate-y-1 flex items-center gap-2"
                  >
                      <LayoutGrid size={18} /> ABRIR MOCHILA
                  </button>
              </div>
           </div>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] overflow-hidden">
            <div className="border-b border-slate-700/70 px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h3 className="font-black text-cyan-100 text-xl flex items-center gap-2"><Sparkles size={18} className="text-cyan-300" /> Grimório de Cartas</h3>
                    <p className="text-sm text-slate-400 mt-1">Seu histórico de escolhas mostra a build real do personagem, incluindo cartas repetidas e o quanto cada efeito foi empilhado.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                    <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Escolhas</div>
                        <div className="text-2xl font-black text-white">{totalCardPicks}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Únicas</div>
                        <div className="text-2xl font-black text-cyan-200">{selectedCards.length}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Empilhadas</div>
                        <div className="text-2xl font-black text-amber-200">{repeatedStacks}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Skills</div>
                        <div className="text-2xl font-black text-purple-200">{player.skills.length}</div>
                    </div>
                </div>
            </div>

            <div className="p-5">
                {selectedCards.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {selectedCards.map(({ card, count }) => {
                            const categoryMeta = getCardCategoryMeta(card);
                            return (
                                <div key={card.id} className={`group rounded-2xl border p-4 transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.45)] ${getRarityColor(card.rarity)}`}>
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                                            {card.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{card.rarity}</div>
                                                    <div className="font-black text-base text-white leading-tight group-hover:text-cyan-100 transition-colors">{card.name}</div>
                                                </div>
                                                <div className={`shrink-0 min-w-12 text-center rounded-xl border px-2 py-1 ${count > 1 ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-slate-700 bg-slate-950/80 text-slate-300'}`}>
                                                    <div className="text-[9px] uppercase tracking-[0.24em]">vezes</div>
                                                    <div className="text-lg font-black">x{count}</div>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-[0.2em] border rounded-full px-2.5 py-1 ${categoryMeta.tone}`}>{categoryMeta.label}</span>
                                                {count > 1 && <span className="text-[10px] font-bold uppercase tracking-[0.2em] border rounded-full px-2.5 py-1 border-amber-400/30 bg-amber-500/10 text-amber-100">Repetida</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-4 text-sm text-slate-300 leading-relaxed">{card.description}</p>
                                    <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 mb-1">Impacto principal</div>
                                        <div className="text-sm font-semibold text-cyan-100">{getCardEffectPreview(card)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-6 py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                            <Sparkles size={28} />
                        </div>
                        <h4 className="text-lg font-black text-white">Nenhuma carta registrada ainda</h4>
                        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">As cartas escolhidas em level up e chefes vão aparecer aqui com contador de repetições para facilitar a leitura da build.</p>
                    </div>
                )}
            </div>
        </div>
     </div>
  </div>
  )
}

// --- SCREENS ---

export const MenuScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white pointer-events-auto px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/35 via-slate-950 to-black" />
        <HeaderChip icon={<Crosshair size={14} className="text-cyan-300" />}>ARENA PROTOCOL // ONLINE</HeaderChip>
        <h1 className="font-gamer text-5xl sm:text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-indigo-300 to-blue-600 mb-4 tracking-tight text-center drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]">
            HERO<br/>ADVENTURE
    </h1>
                <p className="mb-3 text-slate-300 font-semibold text-xs sm:text-sm tracking-[0.2em] uppercase text-center">RPG tatico de aventura em 3D</p>
                <p className="mb-10 text-slate-500 text-sm sm:text-base text-center max-w-xl">Explore o combate por turnos, evolua sua build e enfrente a campanha com modelos 3D pré-carregados para uma entrada mais fluida.</p>
        <button onClick={onStart} className="group relative w-full max-w-xs sm:max-w-sm px-8 sm:px-16 py-4 sm:py-6 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-gamer font-black text-lg sm:text-2xl transition-all hover:translate-y-[-2px] shadow-[0_10px_24px_rgba(79,70,229,0.45)] flex items-center justify-center gap-4 panel-glow">
      <span className="skew-x-[10deg] flex items-center gap-2"><Play fill="currentColor" /> INICIAR JORNADA</span>
    </button>
  </div>
);

export const TavernScreen: React.FC<{ 
  player: Player, 
  stage: number, 
  killCount: number, 
    dungeonEvolution: number,
    dungeonTotalMonsters: number,
  onHunt: () => void, 
  onBoss: () => void, 
  onDungeon: () => void,
  onShop: () => void,
  onShopFromInventory?: (filter: 'all' | 'equipment' | 'potion' | 'material') => void,
    onAlchemist: () => void,
  shopItems: Item[],
    autoOpenConstellationToken?: number,
  onEquipItem: (item: Item) => void,
  onUnequipItem: (item: Item) => void,
  onUseItem: (itemId: string) => void,
    onSellItem: (item: Item, quantity?: number) => void,
    onUnlockTalent: (nodeId: string) => void,
    onResetTalents: () => void,
    campIntroOnly?: boolean,
    restrictProfileToStatusOnly?: boolean,
    inventoryUnlocked?: boolean,
    inventoryUnlockPromptActive?: boolean,
    onAcknowledgeInventoryUnlock?: () => void,
    cardsUnlockPromptActive?: boolean,
    onAcknowledgeCardsUnlock?: () => void,
    skillsUnlockPromptActive?: boolean,
    onAcknowledgeSkillsUnlock?: () => void,
    constellationUnlockPromptActive?: boolean,
    onAcknowledgeConstellationUnlock?: () => void,
    constellationRespecUnlockPromptActive?: boolean,
    onAcknowledgeConstellationRespecUnlock?: () => void,
    allowCardsInProfile?: boolean,
    fleeUnlocked?: boolean,
    merchantUnlockPromptActive?: boolean,
    onAcknowledgeMerchantUnlock?: () => void,
    dungeonUnlockPromptActive?: boolean,
    onAcknowledgeDungeonUnlock?: () => void,
    alchemistUnlockPromptActive?: boolean,
    onAcknowledgeAlchemistUnlock?: () => void,
    merchantUnlocked?: boolean,
    dungeonUnlocked?: boolean,
    alchemistUnlocked?: boolean,
  showSkillsAction?: boolean,
  autoOpenInventoryToken?: number,
  autoOpenInventoryFilter?: 'all' | 'equipment' | 'potion' | 'material',
  showDiamondHud?: boolean,
}> = ({ player, killCount, onHunt, onBoss, onDungeon, onShop, onShopFromInventory, onAlchemist, shopItems, autoOpenConstellationToken = 0, onEquipItem, onUnequipItem, onUseItem, onSellItem, onUnlockTalent, onResetTalents, campIntroOnly = false, restrictProfileToStatusOnly = false, inventoryUnlocked = false, inventoryUnlockPromptActive = false, onAcknowledgeInventoryUnlock, cardsUnlockPromptActive = false, onAcknowledgeCardsUnlock, skillsUnlockPromptActive = false, onAcknowledgeSkillsUnlock, constellationUnlockPromptActive = false, onAcknowledgeConstellationUnlock, constellationRespecUnlockPromptActive = false, onAcknowledgeConstellationRespecUnlock, allowCardsInProfile = false, fleeUnlocked = false, merchantUnlockPromptActive = false, onAcknowledgeMerchantUnlock, dungeonUnlockPromptActive = false, onAcknowledgeDungeonUnlock, alchemistUnlockPromptActive = false, onAcknowledgeAlchemistUnlock, merchantUnlocked = false, dungeonUnlocked = false, alchemistUnlocked = false, showSkillsAction = false, autoOpenInventoryToken = 0, autoOpenInventoryFilter = 'all', showDiamondHud = false }) => {
  const [showProfile, setShowProfile] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
    const [returnToProfileOnInventoryClose, setReturnToProfileOnInventoryClose] = useState(false);
    const [inventoryInitialFilter, setInventoryInitialFilter] = useState<'all' | 'equipment' | 'potion' | 'material'>('all');
    const [profileInitialTab, setProfileInitialTab] = useState<'overview' | 'cards' | 'skills' | 'constellation' | undefined>(undefined);
    const [isClosing, setIsClosing] = useState(false);
    const [showDungeonConfirm, setShowDungeonConfirm] = useState(false);
        const [showHuntIntroConfirm, setShowHuntIntroConfirm] = useState(false);
    const [showInventoryUnlockPrompt, setShowInventoryUnlockPrompt] = useState(false);
    const [showCardsUnlockPrompt, setShowCardsUnlockPrompt] = useState(false);
    const [showSkillsUnlockPrompt, setShowSkillsUnlockPrompt] = useState(false);
    const [showConstellationUnlockPrompt, setShowConstellationUnlockPrompt] = useState(false);
    const [showMerchantUnlockPrompt, setShowMerchantUnlockPrompt] = useState(false);
    const [showDungeonUnlockPrompt, setShowDungeonUnlockPrompt] = useState(false);
    const [showAlchemistUnlockPrompt, setShowAlchemistUnlockPrompt] = useState(false);
    const showDiamondOnTopHud = showDiamondHud;
    const bossUnlocked = killCount >= 10;
    const canAccessDungeon = dungeonUnlocked;
    const killsRemaining = Math.max(0, 10 - killCount);
    const currentClass = getPlayerClassById(player.classId);
    const classAccentColor = currentClass.visualProfile.secondaryColor;
    const hpPercent = player.stats.maxHp > 0 ? Math.min(100, (player.stats.hp / player.stats.maxHp) * 100) : 0;
    const mpPercent = player.stats.maxMp > 0 ? Math.min(100, (player.stats.mp / player.stats.maxMp) * 100) : 0;
    const xpPercent = player.xpToNext > 0 ? Math.min(100, (player.xp / player.xpToNext) * 100) : 0;
    const hasConstellationUnlocked = player.talentPoints > 0 || player.unlockedTalentNodeIds.length > 0;
    const availableConstellationPoints = Math.max(0, player.talentPoints);
    const openProfileModal = (initialTab?: 'overview' | 'cards' | 'skills' | 'constellation') => {
        setProfileInitialTab(initialTab);
        if (!showProfile) {
            uiSfx.play('modal_open');
        }
        setShowProfile(true);
    };
    const closeProfileModal = () => {
        if (!showProfile) {
            return;
        }
        setShowProfile(false);
        uiSfx.play('modal_close');
    };
    const openInventoryModal = (initialFilter: 'all' | 'equipment' | 'potion' | 'material' = 'all', fromProfile = false) => {
        setInventoryInitialFilter(initialFilter);
        setReturnToProfileOnInventoryClose(fromProfile);
        if (!showInventory) {
            uiSfx.play('modal_open');
        }
        setShowInventory(true);
    };
    const closeInventoryModal = () => {
        if (showInventory) {
            uiSfx.play('modal_close');
        }
        setShowInventory(false);
        if (returnToProfileOnInventoryClose) {
            setReturnToProfileOnInventoryClose(false);
            uiSfx.play('modal_open');
            setShowProfile(true);
        }
    };
    const profileActions = [
        {
            id: 'profile',
            label: 'Perfil',
            icon: <GameAssetIcon name="book" size={20} />,
            accent: 'border-[#cfab91] bg-[#f4e5d4] text-[#6b3141] hover:bg-[#e9d7c2]',
            onClick: () => {
                openProfileModal(undefined);
            },
        },
        ...(hasConstellationUnlocked ? [{
            id: 'constellation',
            label: 'Constelacao',
            icon: <Orbit size={18} />,
            accent: 'border-[#cfab91] bg-[#f4e5d4] text-[#6b3141] hover:bg-[#e9d7c2]',
            badge: availableConstellationPoints > 0 ? availableConstellationPoints : undefined,
            onClick: () => {
                openProfileModal('constellation');
            },
        }] : []),
        ...((!campIntroOnly || inventoryUnlocked) ? [{
            id: 'inventory',
            label: 'Mochila',
            icon: <GameAssetIcon name="bag" size={20} />,
            accent: 'border-[#cfab91] bg-[#f4e5d4] text-[#6b3141] hover:bg-[#e9d7c2]',
            onClick: () => {
                openInventoryModal('all');
            },
        }] : []),
    ];

    useEffect(() => {
        if (inventoryUnlockPromptActive) {
            setShowInventoryUnlockPrompt(true);
        }
    }, [inventoryUnlockPromptActive]);

    useEffect(() => {
        if (cardsUnlockPromptActive) {
            setShowCardsUnlockPrompt(true);
        }
    }, [cardsUnlockPromptActive]);

    useEffect(() => {
        if (skillsUnlockPromptActive) {
            setShowSkillsUnlockPrompt(true);
        }
    }, [skillsUnlockPromptActive]);

    useEffect(() => {
        if (constellationUnlockPromptActive) {
            setShowConstellationUnlockPrompt(true);
        }
    }, [constellationUnlockPromptActive]);

    useEffect(() => {
        if (merchantUnlockPromptActive) {
            setShowMerchantUnlockPrompt(true);
        }
    }, [merchantUnlockPromptActive]);

    useEffect(() => {
        if (dungeonUnlockPromptActive) {
            setShowDungeonUnlockPrompt(true);
        }
    }, [dungeonUnlockPromptActive]);

    useEffect(() => {
        if (alchemistUnlockPromptActive) {
            setShowAlchemistUnlockPrompt(true);
        }
    }, [alchemistUnlockPromptActive]);

    useEffect(() => {
        if (!showInventoryUnlockPrompt && !showCardsUnlockPrompt && !showSkillsUnlockPrompt && !showConstellationUnlockPrompt && !showMerchantUnlockPrompt && !showDungeonUnlockPrompt && !showAlchemistUnlockPrompt) {
            return;
        }

        const handleBlockEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        window.addEventListener('keydown', handleBlockEscape, true);
        return () => window.removeEventListener('keydown', handleBlockEscape, true);
    }, [showCardsUnlockPrompt, showConstellationUnlockPrompt, showInventoryUnlockPrompt, showSkillsUnlockPrompt, showMerchantUnlockPrompt, showDungeonUnlockPrompt, showAlchemistUnlockPrompt]);

    useEffect(() => {
        if (autoOpenConstellationToken <= 0) {
            return;
        }

        openProfileModal('constellation');
    }, [autoOpenConstellationToken]);
    const lastHandledInventoryAutoOpenTokenRef = useRef<number>(0);
    useEffect(() => {
        if (autoOpenInventoryToken <= 0) {
            return;
        }
        if (autoOpenInventoryToken === lastHandledInventoryAutoOpenTokenRef.current) {
            return;
        }
        lastHandledInventoryAutoOpenTokenRef.current = autoOpenInventoryToken;
        openInventoryModal(autoOpenInventoryFilter, false);
    }, [autoOpenInventoryFilter, autoOpenInventoryToken]);
    const serviceActions = [
        ...(merchantUnlocked ? [{
            id: 'merchant',
            label: 'Mercador',
            subtitle: 'Loja de equipamentos',
            icon: <GameAssetIcon name="chest" size={24} />,
            accent: 'border-amber-400/40 bg-amber-50 text-[#8d5e29] hover:bg-amber-100',
            onClick: onShop,
        }] : []),
        ...(alchemistUnlocked ? [{
            id: 'alchemist',
            label: 'Alquimista',
            subtitle: 'Cartas e itens unicos',
            icon: <FlaskConical size={22} />,
            accent: 'border-cyan-400/40 bg-cyan-50 text-[#2f6274] hover:bg-cyan-100',
            onClick: onAlchemist,
        }] : []),
    ];

    const handleMenuTransition = (target: 'hunt' | 'dungeon') => {
        if (isClosing) return;
        if (target === 'hunt') {
            setShowHuntIntroConfirm(true);
            return;
        }
        if (target === 'dungeon') {
            if (!canAccessDungeon) {
                return;
            }
            setShowDungeonConfirm(true);
            return;
        }
        setIsClosing(true);
        setTimeout(() => { onHunt(); }, 240);
    };

    const confirmEnterDungeon = () => {
        setShowDungeonConfirm(false);
        uiSfx.play('confirm_hunt_dungeon');
        setIsClosing(true);
        setTimeout(() => { onDungeon(); }, 240);
    };

    const confirmEnterHunt = () => {
        setShowHuntIntroConfirm(false);
        uiSfx.play('confirm_hunt_dungeon');
        setIsClosing(true);
        setTimeout(() => { onHunt(); }, 240);
    };
    const handleServiceTransition = (action: () => void) => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => { action(); }, 240);
    };
    const openShopFromInventory = () => {
        if (showInventory) {
            uiSfx.play('modal_close');
        }
        setShowInventory(false);
        setReturnToProfileOnInventoryClose(false);
        if (onShopFromInventory) {
            onShopFromInventory(inventoryInitialFilter);
            return;
        }
        handleServiceTransition(onShop);
    };
  
  return (
    <>
     <div className={`absolute inset-0 z-40 text-white ${isClosing ? 'animate-[tavernBackdropOut_240ms_ease-in_forwards]' : 'animate-[tavernBackdropIn_280ms_ease-out_both]'}`}>
                <style>{`
                    @keyframes tavernBackdropIn {
                        0% { opacity: 0; }
                        100% { opacity: 1; }
                    }
                    @keyframes tavernBackdropOut {
                        0% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                `}</style>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(10,16,28,0.04)_0%,rgba(8,12,18,0.46)_64%,rgba(0,0,0,0.62)_100%)] pointer-events-none" />

                <section className="absolute top-2 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:top-5 sm:left-5 w-[min(94vw,320px)] sm:w-[min(92vw,360px)] rounded-2xl border border-[#cfab91] bg-[#fff7ed]/95 p-2.5 sm:p-4 shadow-[0_20px_40px_rgba(0,0,0,0.25)] pointer-events-auto">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a7068]">Painel do jogador</div>
                            <h2 className="mt-1 font-gamer text-lg sm:text-2xl text-[#6b3141]">{player.name}</h2>
                            <p className="mt-0.5 text-[11px] sm:text-xs text-[#8f6c67]">{currentClass.name} • {currentClass.title}</p>
                        </div>
                        <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-2.5 py-1.5 text-center min-w-[4rem]">
                            <div className="text-[9px] uppercase tracking-[0.18em] text-[#9a7068]">Nv</div>
                            <div className="text-lg font-black text-[#6b3141]">{player.level}</div>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2.5">
                        <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a4151]">
                                <span>Vida</span>
                                <span>{player.stats.hp}/{player.stats.maxHp}</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#e9d7c2] overflow-hidden border border-[#dcc0aa]">
                                <div className="h-full rounded-full bg-[linear-gradient(90deg,#8d2f46,#d17482)] transition-all" style={{ width: `${hpPercent}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-[#346c7f]">
                                <span>Mana</span>
                                <span>{player.stats.mp}/{player.stats.maxMp}</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#e9d7c2] overflow-hidden border border-[#dcc0aa]">
                                <div className="h-full rounded-full bg-[linear-gradient(90deg,#2b6878,#66b8d2)] transition-all" style={{ width: `${mpPercent}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-[#8d5e29]">
                                <span>XP</span>
                                <span>{player.xp}/{player.xpToNext}</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#e9d7c2] overflow-hidden border border-[#dcc0aa]">
                                <div className="h-full rounded-full bg-[linear-gradient(90deg,#7d3d4d,#c89a66)] transition-all" style={{ width: `${xpPercent}%` }} />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="absolute top-[8.8rem] left-1/2 -translate-x-1/2 sm:translate-x-0 sm:top-5 sm:left-auto sm:right-5 w-[min(94vw,320px)] sm:w-[min(92vw,340px)] flex flex-col gap-2 pointer-events-auto">
                    <div className={`rounded-2xl border border-[#cfab91] bg-[#fff7ed]/95 p-2.5 sm:p-3 shadow-[0_20px_40px_rgba(0,0,0,0.25)] ${showDiamondOnTopHud ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1'}`}>
                        <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2">
                            <div className="text-[9px] uppercase tracking-[0.2em] text-[#9a7068]">Ouro</div>
                            <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-[#8d5e29]">
                                <GameAssetIcon name="coin" size={16} /> {player.gold}
                            </div>
                        </div>
                        {showDiamondOnTopHud && (
                            <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2">
                                <div className="text-[9px] uppercase tracking-[0.2em] text-[#9a7068]">Diamante</div>
                                <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-[#346c7f]">
                                    <GameAssetIcon name="diamond" size={16} /> {player.diamonds}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-[#cfab91] bg-[#fff7ed]/95 p-2.5 sm:p-3 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                        <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a7068] mb-2">Perfil e mochila</div>
                        <div className={`grid gap-2 ${profileActions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {profileActions.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={action.onClick}
                                    className={`relative rounded-xl border px-2.5 sm:px-3 py-2 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-[0.12em] text-[9px] sm:text-[10px] ${action.accent}`}
                                >
                                    {action.icon}
                                    <span>{action.label}</span>
                                    {action.badge && (
                                        <span
                                            className="absolute -top-1.5 -right-1.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full border px-1 text-[10px] font-black text-white"
                                            style={{ borderColor: `${classAccentColor}cc`, backgroundColor: classAccentColor, boxShadow: `0 4px 10px ${classAccentColor}55` }}
                                        >
                                            {action.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {!campIntroOnly && serviceActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleServiceTransition(action.onClick)}
                            className={`hidden sm:block rounded-2xl border px-4 py-3 transition-all hover:-translate-y-0.5 pointer-events-auto ${action.accent}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl border border-[#dcc0aa] bg-[#f7ecdd] flex items-center justify-center shrink-0">{action.icon}</div>
                                <div className="text-left">
                                    <div className="text-sm font-black uppercase tracking-[0.12em]">{action.label}</div>
                                    <div className="text-[11px] font-semibold opacity-80">{action.subtitle}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </section>

                <section className="absolute left-1/2 -translate-x-1/2 bottom-2 sm:bottom-6 w-[min(94vw,380px)] sm:w-[min(96vw,900px)] pointer-events-none">
                    <div className="text-center text-[#f8eddf] drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)] mb-1.5 sm:mb-3 pointer-events-none">
                        <div className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.24em]">Aventura</div>
                        {!bossUnlocked && <div className="mt-0.5 text-[9px] sm:text-xs font-bold uppercase tracking-[0.16em] text-[#f8d9c1]">Faltam {killsRemaining} para liberar o chefao</div>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pointer-events-auto mb-2 sm:hidden">
                        {!campIntroOnly && serviceActions.map((action) => (
                            <button
                                key={`mobile_${action.id}`}
                                onClick={() => handleServiceTransition(action.onClick)}
                                className={`rounded-xl border px-2.5 py-2.5 text-center transition-all hover:-translate-y-0.5 ${action.accent}`}
                            >
                                <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-[0.1em]">
                                    {action.icon}
                                    {action.label}
                                </div>
                            </button>
                        ))}
                        <button onClick={() => handleMenuTransition('hunt')} className="rounded-xl border border-[#b26a2e] bg-[#b87a3a]/95 px-2.5 py-2.5 text-center transition-all hover:-translate-y-0.5 hover:bg-[#c88a4a]">
                            <div className="flex items-center justify-center gap-1.5 text-xs font-black text-white"><Sword size={17} /> Cacar</div>
                        </button>

                        {canAccessDungeon && (
                            <button onClick={() => handleMenuTransition('dungeon')} className="rounded-xl border border-[#3b6580] bg-[#4d7a96]/95 px-2.5 py-2.5 text-center transition-all hover:-translate-y-0.5 hover:bg-[#5a8aa6]">
                                <div className="flex items-center justify-center gap-1.5 text-xs font-black text-white"><Crosshair size={17} /> Dungeon</div>
                            </button>
                        )}

                    </div>

                    {!campIntroOnly && bossUnlocked && (
                        <button onClick={() => handleServiceTransition(onBoss)} className="mb-2 rounded-xl border border-[#a83a42] bg-[#c44b54]/95 px-2.5 py-2.5 text-center transition-all hover:-translate-y-0.5 hover:bg-[#b5424a] pointer-events-auto sm:hidden">
                            <div className="flex items-center justify-center gap-1.5 text-xs font-black text-white"><Skull size={17} /> Chefao</div>
                        </button>
                    )}

                    <div className={`hidden sm:grid gap-2.5 pointer-events-auto ${canAccessDungeon && bossUnlocked ? 'sm:grid-cols-3' : canAccessDungeon ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                        <button onClick={() => handleMenuTransition('hunt')} className="rounded-2xl border border-[#b26a2e] bg-[#b87a3a]/95 px-4 py-4 text-center transition-all hover:-translate-y-0.5 hover:bg-[#c88a4a]">
                            <div className="flex items-center justify-center gap-2 text-base sm:text-lg font-black text-white"><Sword size={20} /> Cacar</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#f8eddf]">Batalha rapida</div>
                        </button>

                        {canAccessDungeon && (
                            <button onClick={() => handleMenuTransition('dungeon')} className="rounded-2xl border border-[#3b6580] bg-[#4d7a96]/95 px-4 py-4 text-center transition-all hover:-translate-y-0.5 hover:bg-[#5a8aa6]">
                                <div className="flex items-center justify-center gap-2 text-base sm:text-lg font-black text-white"><Crosshair size={20} /> Dungeon</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-sky-100">Modo progressivo</div>
                            </button>
                        )}

                        {canAccessDungeon && bossUnlocked && (
                        <button onClick={() => handleServiceTransition(onBoss)} className="rounded-2xl border px-4 py-4 text-center transition-all border-[#a83a42] bg-[#c44b54]/95 hover:-translate-y-0.5 hover:bg-[#b5424a]">
                            <div className="flex items-center justify-center gap-2 text-base sm:text-lg font-black text-white"><Skull size={20} /> Chefao</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-rose-100">Avanca fase</div>
                        </button>
                        )}
                    </div>
                </section>
            </div>
    <AnimatedModal open={showProfile}>
        {(isClosing) => (
            <CharacterSheetModal player={player} shopItems={shopItems} onClose={closeProfileModal} onOpenInventory={(initialFilter) => { closeProfileModal(); openInventoryModal(initialFilter ?? 'all', true); }} onUnlockTalent={onUnlockTalent} onResetTalents={onResetTalents} respecUnlockPromptActive={constellationRespecUnlockPromptActive} onAcknowledgeRespecUnlock={onAcknowledgeConstellationRespecUnlock} isClosing={isClosing} restrictToStatusOnly={restrictProfileToStatusOnly} allowInventory={inventoryUnlocked} allowCardsTab={allowCardsInProfile} allowSkillsTab={showSkillsAction} allowConstellationTab={hasConstellationUnlocked} initialTab={profileInitialTab} />
        )}
    </AnimatedModal>
    <AnimatedModal open={showInventory}>
        {(isClosing) => (
            <InventoryModal player={player} shopItems={shopItems} onClose={closeInventoryModal} onOpenShop={merchantUnlocked ? openShopFromInventory : undefined} onEquip={onEquipItem} onUnequip={onUnequipItem} onUse={onUseItem} onSell={onSellItem} isBattleContext={false} initialFilter={inventoryInitialFilter} isClosing={isClosing} />
        )}
    </AnimatedModal>

    {showInventoryUnlockPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#6b3141] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <GameAssetIcon name="bag" size={14} /> Mochila
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Mochila liberada</h3>
                    <p className="mt-1.5 text-sm text-[#dcc0aa]">Agora voce ja pode abrir a mochila para ver todos os itens conquistados nas batalhas.</p>
                </div>

                <div className="px-6 py-5">
                    <button
                        onClick={() => {
                            setShowInventoryUnlockPrompt(false);
                            onAcknowledgeInventoryUnlock?.();
                            openInventoryModal('all');
                        }}
                        className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                    >
                        Ver mochila
                    </button>
                </div>
            </div>
        </div>
    )}

    {showCardsUnlockPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#6b3141] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <GameAssetIcon name="scroll" size={14} /> Cartas
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Evolucao liberada</h3>
                    <p className="mt-1.5 text-sm text-[#dcc0aa]">Voce ganhou sua primeira carta. Abra o perfil para ver suas cartas de evolucao.</p>
                </div>

                <div className="px-6 py-5">
                    <button
                        onClick={() => {
                            setShowCardsUnlockPrompt(false);
                            onAcknowledgeCardsUnlock?.();
                            openProfileModal('cards');
                        }}
                        className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                    >
                        Ver cartas
                    </button>
                </div>
            </div>
        </div>
    )}

    {showSkillsUnlockPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#6b3141] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <Sparkles size={14} /> Habilidades
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Habilidades liberadas</h3>
                    <p className="mt-1.5 text-sm text-[#dcc0aa]">Voce conquistou sua primeira habilidade. Abra o perfil para ver e gerenciar todas as habilidades da sua classe.</p>
                </div>

                <div className="px-6 py-5">
                    <button
                        onClick={() => {
                            setShowSkillsUnlockPrompt(false);
                            onAcknowledgeSkillsUnlock?.();
                            openProfileModal('skills');
                        }}
                        className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                    >
                        Ver habilidades
                    </button>
                </div>
            </div>
        </div>
    )}

    {showConstellationUnlockPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#6b3141] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <Orbit size={14} /> Constelacao
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Constelacao habilitada</h3>
                    <p className="mt-1.5 text-sm text-[#dcc0aa]">Ao subir de nivel voce ganha pontos de evolucao. Agora voce pode abrir sua constelacao.</p>
                </div>

                <div className="px-6 py-5">
                    <button
                        onClick={() => {
                            setShowConstellationUnlockPrompt(false);
                            onAcknowledgeConstellationUnlock?.();
                            openProfileModal('constellation');
                        }}
                        className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                    >
                        Ver constelacao
                    </button>
                </div>
            </div>
        </div>
    )}

    {showMerchantUnlockPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#6b3141] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <GameAssetIcon name="chest" size={14} /> Mercador
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Mercador liberado</h3>
                    <p className="mt-1.5 text-sm text-[#dcc0aa]">No mercador voce pode comprar itens de cura, armas e equipamentos para ficar mais forte. Tudo que comprar fica na mochila para usar nas batalhas.</p>
                </div>

                <div className="px-6 py-5">
                    <button
                        onClick={() => {
                            setShowMerchantUnlockPrompt(false);
                            onAcknowledgeMerchantUnlock?.();
                            handleServiceTransition(onShop);
                        }}
                        className="w-full rounded-xl bg-[#b87a3a] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(184,122,58,0.3)] transition-all hover:bg-[#c88a4a]"
                    >
                        Ver mercador
                    </button>
                </div>
            </div>
        </div>
    )}

    {showDungeonUnlockPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#6b3141] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <GameAssetIcon name="map" size={14} /> Dungeon
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Dungeon liberada</h3>
                    <p className="mt-1.5 text-sm text-[#dcc0aa]">Um novo modo de risco foi desbloqueado. Na dungeon voce enfrenta uma sequência longa de inimigos para acumular espolio raro, mas derrotas podem custar tudo.</p>
                </div>

                <div className="px-6 py-5">
                    <button
                        onClick={() => {
                            setShowDungeonUnlockPrompt(false);
                            onAcknowledgeDungeonUnlock?.();
                        }}
                        className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                    >
                        Entendi
                    </button>
                </div>
            </div>
        </div>
    )}

    {showAlchemistUnlockPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-[#96bccb] bg-[#eef8fe] shadow-[0_30px_80px_rgba(47,98,116,0.26)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[linear-gradient(135deg,#2b6878,#66b8d2)] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f2fbff]">
                        <FlaskConical size={12} /> Alquimista
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Loja do Alquimista</h3>
                    <p className="mt-1.5 text-sm text-[#e4f6ff]">Voce desbloqueou o alquimista. Agora pode comprar cartas e itens unicos com raridades comum, rara e lendaria.</p>
                </div>

                <div className="px-6 py-5">
                    <button
                        onClick={() => {
                            setShowAlchemistUnlockPrompt(false);
                            onAcknowledgeAlchemistUnlock?.();
                            handleServiceTransition(onAlchemist);
                        }}
                        className="w-full rounded-xl bg-[#2b6878] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(47,98,116,0.32)] transition-all hover:bg-[#357b8e]"
                    >
                        Ver alquimista
                    </button>
                </div>
            </div>
        </div>
    )}

    {showHuntIntroConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4" onClick={() => setShowHuntIntroConfirm(false)}>
            <div className="w-full max-w-sm rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#6b3141] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <Sword size={12} /> Caca
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Entrar na Caca?</h3>
                    <p className="mt-1.5 text-sm text-[#dcc0aa]">Primeiro passo da sua jornada.</p>
                </div>

                <div className="flex flex-col gap-3 px-6 py-5">
                    <div className="flex items-start gap-3 rounded-2xl border border-[#4d7a96]/25 bg-[#4d7a96]/8 px-4 py-3">
                        <Crosshair size={16} className="text-[#4d7a96] mt-0.5 shrink-0" />
                        <p className="text-sm text-[#6b3141] leading-snug"><span className="font-black">Caca e batalha curta.</span> Enfrente inimigos, ganhe experiencia, conquiste itens e evolua no seu proprio ritmo.</p>
                    </div>
                    {fleeUnlocked && (
                        <div className="flex items-start gap-3 rounded-2xl border border-[#c44b54]/25 bg-[#c44b54]/8 px-4 py-3">
                            <AlertTriangle size={16} className="text-[#c44b54] mt-0.5 shrink-0" />
                            <p className="text-sm text-[#6b3141] leading-snug"><span className="font-black">Voce pode fugir.</span> Se quiser recuar durante a luta, use a opcao de retirada.</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 px-6 pb-6">
                    <button onClick={() => setShowHuntIntroConfirm(false)} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
                        Cancelar
                    </button>
                    <button onClick={confirmEnterHunt} className="rounded-xl bg-[#b87a3a] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(184,122,58,0.3)] transition-all hover:bg-[#c88a4a]">
                        Entrar
                    </button>
                </div>
            </div>
        </div>
    )}

    {showDungeonConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto p-4" onClick={() => setShowDungeonConfirm(false)}>
            <div className="w-full max-w-sm rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_80px_rgba(107,49,65,0.22)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#6b3141] px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <Crosshair size={12} /> Dungeon
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-white">Entrar na Dungeon?</h3>
                    <p className="mt-1.5 text-sm text-[#dcc0aa]">Leia as regras antes de entrar.</p>
                </div>

                <div className="flex flex-col gap-3 px-6 py-5">
                    <div className="flex items-start gap-3 rounded-2xl border border-[#c44b54]/25 bg-[#c44b54]/8 px-4 py-3">
                        <AlertTriangle size={16} className="text-[#c44b54] mt-0.5 shrink-0" />
                        <p className="text-sm text-[#6b3141] leading-snug"><span className="font-black">Sem fuga.</span> Uma vez dentro, não é possível abandonar a dungeon voluntariamente.</p>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-[#c44b54]/25 bg-[#c44b54]/8 px-4 py-3">
                        <Skull size={16} className="text-[#c44b54] mt-0.5 shrink-0" />
                        <p className="text-sm text-[#6b3141] leading-snug"><span className="font-black">Morte = tudo perdido.</span> Ouro, XP, diamantes e itens acumulados durante a dungeon são perdidos.</p>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-[#4d7a96]/25 bg-[#4d7a96]/8 px-4 py-3">
                        <Sparkles size={16} className="text-[#4d7a96] mt-0.5 shrink-0" />
                        <p className="text-sm text-[#6b3141] leading-snug"><span className="font-black">Derrotar o boss = vitória total.</span> Tudo que você acumulou ao longo da dungeon é seu ao vencer o chefão.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 px-6 pb-6">
                    <button onClick={() => setShowDungeonConfirm(false)} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
                        Cancelar
                    </button>
                    <button onClick={confirmEnterDungeon} className="rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]">
                        Entrar
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

const describeCardEffect = (card: ProgressionCard) => {
    return card.effects.map(effect => {
        const scaledValue = getScaledCardEffectValue(card, effect);
        const value = Number.isInteger(scaledValue) ? scaledValue : `${Math.round(scaledValue * 100)}%`;
        const skillName = effect.skillId ? SKILLS.find(skill => skill.id === effect.skillId)?.name : null;

        switch (effect.type) {
            case 'gold_instant': return `+${value} Ouro agora`;
            case 'xp_instant': return `+${value} XP agora`;
            case 'max_hp': return `+${value} Vida maxima`;
            case 'max_mp': return `+${value} Mana maxima`;
            case 'atk': return `+${value} Ataque`;
            case 'magic': return `+${value} Magia`;
            case 'def': return `+${value} Defesa`;
            case 'speed': return `+${value} Velocidade`;
            case 'luck': return `+${value} Sorte`;
            case 'gold_gain_multiplier': return `+${value} de ouro por batalha`;
            case 'xp_gain_multiplier': return `+${value} de XP por batalha`;
            case 'boss_damage_multiplier': return `+${value} de dano contra chefes`;
            case 'heal_multiplier': return `+${value} de cura em habilidades e itens`;
            case 'opening_atk_buff': return `Buff inicial de ataque: +${value}`;
            case 'opening_def_buff': return `Buff inicial de defesa: +${value}`;
            case 'defend_mana_restore': return `Recupera +${value} de mana ao defender`;
            case 'counter_attack_chance_bonus': return `+${value} de chance de contra-ataque`;
            case 'opening_counter_attack_boost': return `+${value} de chance de contra nos 2 primeiros turnos`;
            case 'hp_regen_per_turn': return `Regenera ${value} HP a cada turno`;
            case 'mp_regen_per_turn': return `Regenera ${value} MP a cada turno`;
            case 'unlock_skill': return skillName ? `Desbloqueia habilidade: ${skillName}` : 'Desbloqueia nova habilidade';
            default: return card.description;
        }
    });
};

const getAlchemistRelicMeta = (item: Item) => {
    if (item.id === 'pot_dg_recall') {
        return {
            badge: 'Extração',
            title: 'Relíquia de extração',
            useLabel: 'Dungeon',
            lines: [
                'Ativa uma fuga estável da dungeon sem perder ouro, XP, diamantes ou drops acumulados.',
                'Ao usar, o jogo confirma a escolha e em seguida abre a tela de espólio resgatado.',
            ],
            footer: 'A relíquia vai para o inventário e pode ser usada durante a dungeon.',
        };
    }

    if (item.id === 'pot_alc_phantom_veil') {
        return {
            badge: 'Combate',
            title: 'Relíquia de combate',
            useLabel: 'Batalha',
            lines: [
                'Ao usar, o herói ativa evasão perfeita e ignora completamente ataques inimigos por 4 turnos em qualquer batalha.',
                'A duração diminui a cada turno inimigo concluído, mesmo se o golpe falhar ou o inimigo apenas defender.',
            ],
            footer: 'A relíquia vai para o inventário e pode ser usada em qualquer batalha.',
        };
    }

    if (item.id === 'pot_alc_twin_fang') {
        return {
            badge: 'Ofensiva',
            title: 'Relíquia ofensiva',
            useLabel: 'Batalha',
            lines: [
                'Ao usar, o comando Atacar desfere dois golpes seguidos por 6 turnos.',
                'Enquanto durar, habilidades físicas também são repetidas uma segunda vez sem custo extra de mana.',
            ],
            footer: 'A relíquia vai para o inventário e pode ser usada em qualquer batalha para acelerar o dano básico.',
        };
    }

    return {
        badge: 'Relíquia',
        title: 'Relíquia rara',
        useLabel: 'Especial',
        lines: [item.description],
        footer: 'A relíquia vai para o inventário ao ser comprada.',
    };
};

const getCardCategoryBadge = (card: ProgressionCard) => {
    if (card.category === 'economia') return { icon: <Coins size={14} />, label: 'Economia', color: 'text-amber-700 border-amber-300 bg-amber-100' };
    if (card.category === 'atributo') return { icon: <Heart size={14} />, label: 'Atributos', color: 'text-emerald-700 border-emerald-300 bg-emerald-100' };
    if (card.category === 'batalha') return { icon: <Crosshair size={14} />, label: 'Combate', color: 'text-rose-700 border-rose-300 bg-rose-100' };
    return { icon: <Sparkles size={14} />, label: 'Especial', color: 'text-sky-700 border-sky-300 bg-sky-100' };
};

export const CardChoiceScreen: React.FC<{ offer: CardRewardOffer, cards: ProgressionCard[], onSelect: (card: ProgressionCard) => void }> = ({ offer, cards, onSelect }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isExiting, setIsExiting] = useState(false);

    const handlePick = (card: ProgressionCard) => {
        if (selectedId) return;
        uiSfx.play('card_select_evolution');
        setSelectedId(card.id);
        setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onSelect(card), 500);
        }, 900);
    };

    return (
    <div className={`absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 pointer-events-auto ${isExiting ? 'animate-[cardScreenFadeOut_0.5s_ease-in_both]' : 'animate-[cardScreenFadeIn_0.5s_ease-out_both]'}`}>
        <style>{`
            @keyframes cardScreenFadeIn {
                0% { opacity: 0; }
                100% { opacity: 1; }
            }
            @keyframes cardScreenFadeOut {
                0% { opacity: 1; }
                100% { opacity: 0; }
            }
            @keyframes cardScreenSlideUp {
                0% { opacity: 0; transform: scale(0.92) translateY(30px); }
                100% { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes cardSelected {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(250,204,21,0); }
                30% { transform: scale(1.04); box-shadow: 0 0 40px 8px rgba(250,204,21,0.5); }
                60% { transform: scale(1.02); box-shadow: 0 0 60px 16px rgba(250,204,21,0.3); }
                100% { transform: scale(1.0); box-shadow: 0 0 80px 24px rgba(250,204,21,0.0); }
            }
            @keyframes cardNotSelected {
                0% { opacity: 1; transform: scale(1); }
                100% { opacity: 0.3; transform: scale(0.95); filter: grayscale(0.6); }
            }
            @keyframes selectedGlow {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 0.8; }
            }
        `}</style>
        <div className="w-full max-w-6xl max-h-[95vh] sm:max-h-none overflow-y-auto rounded-2xl sm:rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_120px_rgba(107,49,65,0.18)] animate-[cardScreenSlideUp_0.5s_ease-out_both]">
            <div className="border-b border-[#dcc0aa] px-4 py-3 sm:px-8 sm:py-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-3 py-1 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#8d5e29]">
                    <Sparkles size={12} /> {selectedId ? 'Carta Selecionada!' : 'Escolha uma carta'}
                </div>
                <h2 className="mt-2 sm:mt-4 text-xl sm:text-4xl font-black text-[#6b3141]">{offer.source === 'boss' ? 'Recompensa do Chefao' : 'Recompensa de Evolucao'}</h2>
                <p className="mt-1 sm:mt-2 text-xs sm:text-base text-[#7f5b56]">{offer.reason}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 p-3 sm:p-8">
                {cards.map(card => {
                    const category = getCardCategoryBadge(card);
                    const effectLines = describeCardEffect(card);
                    const isThis = selectedId === card.id;
                    const isOther = selectedId !== null && selectedId !== card.id;

                    return (
                        <button
                            key={card.id}
                            onClick={() => handlePick(card)}
                            disabled={!!selectedId}
                            className={`group text-left rounded-[16px] sm:rounded-[20px] border p-3.5 sm:p-6 shadow-sm transition-all duration-200 relative overflow-hidden
                                ${isThis ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-400/50' : 'border-[#cfab91] bg-[#f7ecdd]'}
                                ${!selectedId ? 'hover:-translate-y-1 hover:shadow-xl hover:border-[#c59d82] cursor-pointer' : ''}
                                ${isOther ? 'cursor-default' : ''}
                            `}
                            style={isThis ? { animation: 'cardSelected 0.9s ease-out both' } : isOther ? { animation: 'cardNotSelected 0.5s 0.1s ease-out both' } : undefined}
                        >
                            {/* Yellow glow overlay for selected card */}
                            {isThis && (
                                <div className="absolute inset-0 rounded-[16px] sm:rounded-[20px] pointer-events-none"
                                    style={{
                                        background: 'radial-gradient(circle at center, rgba(250,204,21,0.25) 0%, transparent 70%)',
                                        animation: 'selectedGlow 1s ease-in-out infinite',
                                    }}
                                />
                            )}
                            <div className="relative flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-4">
                                <div>
                                    <div className="rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.35em] text-[#9a7068] inline-block mb-1 sm:mb-2">{card.rarity}</div>
                                    <h3 className="text-lg sm:text-2xl font-black text-[#6b3141] leading-tight">{card.name}</h3>
                                </div>
                                <div className={`inline-flex items-center gap-1 rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold shrink-0 ${category.color}`}>
                                    {category.icon}
                                    <span>{category.label}</span>
                                </div>
                            </div>

                            <p className="relative text-xs sm:text-sm text-[#7f5b56] leading-relaxed min-h-8 sm:min-h-12">{card.description}</p>

                            <div className="relative mt-3 sm:mt-5 space-y-1.5 sm:space-y-2">
                                {effectLines.map(line => (
                                    <div key={line} className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#6b3141]">
                                        {line}
                                    </div>
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    </div>
    );
};

export const AlchemistScreen: React.FC<{ player: Player, offers: AlchemistCardOffer[], itemOffers: AlchemistItemOffer[], onBuyCard: (offer: AlchemistCardOffer) => void, onBuyItem: (offer: AlchemistItemOffer) => void, onLeave: () => void }> = ({ player, offers, itemOffers, onBuyCard, onBuyItem, onLeave }) => {
    const [selectedType, setSelectedType] = useState<'card' | 'item'>(offers.length > 0 ? 'card' : 'item');
    const [selectedCardOffer, setSelectedCardOffer] = useState<AlchemistCardOffer | null>(offers[0] ?? null);
    const [selectedItemOffer, setSelectedItemOffer] = useState<AlchemistItemOffer | null>(itemOffers[0] ?? null);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [pendingCardPurchase, setPendingCardPurchase] = useState<AlchemistCardOffer | null>(null);
    const [closeMobileAfterCardPurchase, setCloseMobileAfterCardPurchase] = useState(false);
    const [pendingItemPurchase, setPendingItemPurchase] = useState<AlchemistItemOffer | null>(null);
    const [closeMobileAfterItemPurchase, setCloseMobileAfterItemPurchase] = useState(false);

    useEffect(() => {
        if (!selectedCardOffer || !offers.find(entry => entry.id === selectedCardOffer.id)) {
            setSelectedCardOffer(offers[0] ?? null);
        }
    }, [offers, selectedCardOffer]);

    useEffect(() => {
        if (!selectedItemOffer || !itemOffers.find(entry => entry.id === selectedItemOffer.id)) {
            setSelectedItemOffer(itemOffers[0] ?? null);
        }
    }, [itemOffers, selectedItemOffer]);

    useEffect(() => {
        if (selectedType === 'card' && offers.length === 0 && itemOffers.length > 0) {
            setSelectedType('item');
        }
        if (selectedType === 'item' && itemOffers.length === 0 && offers.length > 0) {
            setSelectedType('card');
        }
    }, [selectedType, offers.length, itemOffers.length]);

    useEffect(() => {
        setMobileDetailOpen(false);
    }, [selectedType]);

    const selectedCard = selectedType === 'card' ? selectedCardOffer : null;
    const selectedItem = selectedType === 'item' ? selectedItemOffer : null;
    const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth < 1280;

    const handleCardSelect = (offer: AlchemistCardOffer) => {
        setSelectedCardOffer(offer);
        if (isMobileViewport()) {
            setMobileDetailOpen(true);
        }
    };

    const handleItemSelect = (offer: AlchemistItemOffer) => {
        setSelectedItemOffer(offer);
        if (isMobileViewport()) {
            setMobileDetailOpen(true);
        }
    };

    const requestCardPurchase = (offer: AlchemistCardOffer, closeMobileAfterPurchase = false) => {
        setPendingCardPurchase(offer);
        setCloseMobileAfterCardPurchase(closeMobileAfterPurchase);
    };

    const confirmCardPurchase = () => {
        if (!pendingCardPurchase) {
            return;
        }
        onBuyCard(pendingCardPurchase);
        setPendingCardPurchase(null);
        if (closeMobileAfterCardPurchase) {
            setMobileDetailOpen(false);
            setCloseMobileAfterCardPurchase(false);
        }
    };

    const requestItemPurchase = (offer: AlchemistItemOffer, closeMobileAfterPurchase = false) => {
        setPendingItemPurchase(offer);
        setCloseMobileAfterItemPurchase(closeMobileAfterPurchase);
    };

    const confirmItemPurchase = () => {
        if (!pendingItemPurchase) {
            return;
        }
        onBuyItem(pendingItemPurchase);
        setPendingItemPurchase(null);
        if (closeMobileAfterItemPurchase) {
            setMobileDetailOpen(false);
            setCloseMobileAfterItemPurchase(false);
        }
    };

    return (
        <div className="absolute inset-0 z-40 bg-black/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 pointer-events-auto">
            <div className="w-full max-w-7xl max-h-[95vh] overflow-hidden rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_120px_rgba(107,49,65,0.18)]">
                <div className="border-b border-[#dcc0aa] px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-xl border border-[#d6b9a3] bg-[#f4e5d4] flex items-center justify-center shrink-0">
                            <FlaskConical className="text-[#7c4c76]" size={18} />
                        </div>
                        <div>
                            <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.28em] text-[#9a7068]">Laboratorio</div>
                            <h2 className="text-lg sm:text-2xl font-black text-[#6b3141]">Alquimista</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="rounded-full border border-[#cfab91] bg-[#f4e5d4] px-3 py-1.5 flex items-center gap-2">
                            <GameAssetIcon name="diamond" size={16} />
                            <span className="font-black text-[#346c7f] text-sm">{player.diamonds}</span>
                        </div>
                        <button onClick={onLeave} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 sm:px-4 py-2 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2] flex items-center gap-2">
                            <Home size={16} /> Voltar
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[24rem_1fr] h-[calc(95vh-78px)]">
                    <aside className="border-b xl:border-b-0 xl:border-r border-[#dcc0aa] bg-[#f4e5d4]/60 flex flex-col min-h-0">
                        <div className="p-3 sm:p-4 border-b border-[#dcc0aa]">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setSelectedType('card');
                                        setMobileDetailOpen(false);
                                    }}
                                    className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.22em] transition-colors ${selectedType === 'card' ? 'border-[#b84a63] bg-[#fbe8ec] text-[#7d3d4d]' : 'border-[#cfab91] bg-[#f7ecdd] text-[#8f6c67] hover:bg-[#efe0cd]'}`}
                                >
                                    Cartas
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedType('item');
                                        setMobileDetailOpen(false);
                                    }}
                                    className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.22em] transition-colors ${selectedType === 'item' ? 'border-[#3b6580] bg-[#e3f2f7] text-[#346c7f]' : 'border-[#cfab91] bg-[#f7ecdd] text-[#8f6c67] hover:bg-[#efe0cd]'}`}
                                >
                                    Reliquias
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                            {selectedType === 'card' ? offers.map((offer) => {
                                const isSelected = selectedCardOffer?.id === offer.id;
                                const alreadyOwned = player.chosenCards.includes(offer.card.id);
                                const lockedByLevel = player.level < offer.card.minLevel;
                                const category = getCardCategoryBadge(offer.card);

                                return (
                                    <button
                                        key={offer.id}
                                        onClick={() => handleCardSelect(offer)}
                                        className={`w-full text-left rounded-[16px] border p-3.5 transition-all ${isSelected ? 'border-[#c59d82] bg-[#fff7ed] shadow-md' : 'border-[#cfab91] bg-[#f7ecdd] hover:-translate-y-0.5 hover:shadow-md'} ${alreadyOwned ? 'opacity-70' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-12 w-12 rounded-xl border border-[#dcc0aa] bg-[#f8eddf] flex items-center justify-center shrink-0">
                                                    <GameAssetIcon name="scroll" size={28} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[9px] uppercase tracking-[0.24em] text-[#9a7068]">{getCardRarityLabel(offer.card.rarity)}</div>
                                                    <div className="font-black text-[#6b3141] truncate">{offer.card.name}</div>
                                                    <div className="text-[11px] text-[#8f6c67] truncate">{offer.tagline}</div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-black text-[#346c7f]">{offer.cost} 💎</div>
                                                <div className="text-[10px] text-[#9a7068]">Lvl {offer.card.minLevel}+</div>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] border rounded-full px-2 py-0.5 ${category.color}`}>
                                                {category.icon}
                                                <span>{category.label}</span>
                                            </span>
                                            {alreadyOwned && <span className="text-[10px] font-bold uppercase tracking-[0.18em] border rounded-full px-2 py-0.5 border-[#cfab91] bg-[#efe0cd] text-[#8f6c67]">Comprada</span>}
                                            {lockedByLevel && <span className="text-[10px] font-bold uppercase tracking-[0.18em] border rounded-full px-2 py-0.5 border-red-300 bg-red-50 text-red-700">Nivel</span>}
                                        </div>
                                    </button>
                                );
                            }) : itemOffers.map((offer) => {
                                const isSelected = selectedItemOffer?.id === offer.id;
                                const lockedByLevel = player.level < offer.item.minLevel;
                                const relicMeta = getAlchemistRelicMeta(offer.item);

                                return (
                                    <button
                                        key={offer.id}
                                        onClick={() => handleItemSelect(offer)}
                                        className={`w-full text-left rounded-[16px] border p-3.5 transition-all ${isSelected ? 'border-[#8eb4c0] bg-[#f0fbff] shadow-md' : 'border-[#cfab91] bg-[#f7ecdd] hover:-translate-y-0.5 hover:shadow-md'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-12 w-12 rounded-xl border border-[#dcc0aa] bg-[#f8eddf] flex items-center justify-center text-2xl shrink-0">{offer.item.icon}</div>
                                                <div className="min-w-0">
                                                    <div className="text-[9px] uppercase tracking-[0.24em] text-[#9a7068]">Reliquia</div>
                                                    <div className="font-black text-[#6b3141] truncate">{offer.item.name}</div>
                                                    <div className="text-[11px] text-[#8f6c67] truncate">{offer.tagline}</div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-black text-[#346c7f]">{offer.cost} 💎</div>
                                                <div className="text-[10px] text-[#9a7068]">Lvl {offer.item.minLevel}+</div>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] border rounded-full px-2 py-0.5 border-cyan-300 bg-cyan-100 text-cyan-700">{relicMeta.badge}</span>
                                            {lockedByLevel && <span className="text-[10px] font-bold uppercase tracking-[0.18em] border rounded-full px-2 py-0.5 border-red-300 bg-red-50 text-red-700">Nivel</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <section className="hidden xl:block min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#f7ecdd]">
                        {selectedType === 'card' && selectedCard ? (() => {
                            const alreadyOwned = player.chosenCards.includes(selectedCard.card.id);
                            const canAfford = player.diamonds >= selectedCard.cost;
                            const hasLevel = player.level >= selectedCard.card.minLevel;
                            const effectLines = describeCardEffect(selectedCard.card);
                            const category = getCardCategoryBadge(selectedCard.card);

                            return (
                                <div className="rounded-[20px] border border-[#cfab91] bg-[#fff7ed] p-4 sm:p-6">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${category.color}`}>
                                                {category.icon}
                                                <span>{category.label}</span>
                                            </div>
                                            <h3 className="mt-3 text-2xl sm:text-4xl font-black text-[#6b3141]">{selectedCard.card.name}</h3>
                                            <p className="mt-2 text-sm sm:text-base text-[#7f5b56] leading-relaxed">{selectedCard.card.description}</p>
                                        </div>
                                        <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-center">
                                            <div className="text-[10px] uppercase tracking-[0.2em] text-[#9a7068]">Preco</div>
                                            <div className="text-2xl font-black text-[#346c7f]">{selectedCard.cost}</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        {effectLines.map(line => (
                                            <div key={line} className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-3 py-2 text-sm font-semibold text-[#6b3141]">{line}</div>
                                        ))}
                                    </div>

                                        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                            <div className="text-sm text-[#8f6c67]">{alreadyOwned ? 'Carta ja comprada.' : !hasLevel ? `Nivel ${selectedCard.card.minLevel} necessario.` : !canAfford ? 'Diamantes insuficientes.' : selectedCard.tagline}</div>
                                            <button
                                            onClick={() => requestCardPurchase(selectedCard)}
                                            disabled={alreadyOwned || !canAfford || !hasLevel}
                                            className={`rounded-xl px-5 py-3 font-black uppercase tracking-[0.16em] transition-all ${alreadyOwned || !canAfford || !hasLevel ? 'bg-[#e9d7c2] text-[#8f6c67] cursor-not-allowed border border-[#dcc0aa]' : 'bg-[#b84a63] text-white hover:bg-[#a53d56] border border-[#a53d56]'}`}
                                        >
                                            Comprar carta
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : selectedType === 'item' && selectedItem ? (() => {
                            const canAfford = player.diamonds >= selectedItem.cost;
                            const hasLevel = player.level >= selectedItem.item.minLevel;
                            const ownedQty = player.inventory[selectedItem.item.id] || 0;
                            const relicMeta = getAlchemistRelicMeta(selectedItem.item);

                            return (
                                <div className="rounded-[20px] border border-[#cfab91] bg-[#fff7ed] p-4 sm:p-6">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                        <div>
                                            <div className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">
                                                <Sparkles size={12} /> {relicMeta.title}
                                            </div>
                                            <h3 className="mt-3 text-2xl sm:text-4xl font-black text-[#6b3141]">{selectedItem.item.name}</h3>
                                            <p className="mt-2 text-sm sm:text-base text-[#7f5b56] leading-relaxed">{selectedItem.item.description}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 min-w-[12rem]">
                                            <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-center">
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-[#9a7068]">Preco</div>
                                                <div className="text-xl font-black text-[#346c7f]">{selectedItem.cost}</div>
                                            </div>
                                            <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-center">
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-[#9a7068]">Estoque</div>
                                                <div className="text-xl font-black text-[#6b3141]">x{ownedQty}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        {relicMeta.lines.map(line => (
                                            <div key={line} className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-3 py-2 text-sm font-semibold text-[#6b3141]">{line}</div>
                                        ))}
                                    </div>

                                        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                            <div className="text-sm text-[#8f6c67]">{!hasLevel ? `Nivel ${selectedItem.item.minLevel} necessario.` : !canAfford ? 'Diamantes insuficientes.' : relicMeta.footer}</div>
                                            <button
                                            onClick={() => requestItemPurchase(selectedItem)}
                                            disabled={!canAfford || !hasLevel}
                                            className={`rounded-xl px-5 py-3 font-black uppercase tracking-[0.16em] transition-all ${!canAfford || !hasLevel ? 'bg-[#e9d7c2] text-[#8f6c67] cursor-not-allowed border border-[#dcc0aa]' : 'bg-[#3b6580] text-white hover:bg-[#34586f] border border-[#34586f]'}`}
                                        >
                                            Comprar reliquia
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="rounded-[20px] border border-dashed border-[#cfab91] bg-[#f4e7d5] px-6 py-12 text-center text-[#8f6c67]">
                                Nenhum item disponivel no estoque.
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {mobileDetailOpen && (
                <div className="xl:hidden absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-2 sm:p-4" onClick={() => setMobileDetailOpen(false)}>
                    <div className="w-full max-w-lg max-h-[92vh] rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.15)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                        <div className="flex items-center justify-between gap-3 border-b border-[#dcc0aa] px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-[#6b3141]"><ArrowLeft size={16} /> Detalhes</h3>
                            <button onClick={() => setMobileDetailOpen(false)} className="rounded-lg border border-[#cfab91] bg-[#f4e5d4] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
                                Fechar
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 sm:p-5">
                            {selectedType === 'card' && selectedCard ? (() => {
                                const alreadyOwned = player.chosenCards.includes(selectedCard.card.id);
                                const canAfford = player.diamonds >= selectedCard.cost;
                                const hasLevel = player.level >= selectedCard.card.minLevel;
                                const effectLines = describeCardEffect(selectedCard.card);
                                const category = getCardCategoryBadge(selectedCard.card);

                                return (
                                    <div className="rounded-[20px] border border-[#cfab91] bg-[#fff7ed] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${category.color}`}>
                                                {category.icon}
                                                <span>{category.label}</span>
                                            </div>
                                            <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-1.5 text-center">
                                                <div className="text-[9px] uppercase tracking-[0.2em] text-[#9a7068]">Preco</div>
                                                <div className="text-lg font-black text-[#346c7f]">{selectedCard.cost} 💎</div>
                                            </div>
                                        </div>

                                        <h4 className="mt-3 text-2xl font-black text-[#6b3141]">{selectedCard.card.name}</h4>
                                        <p className="mt-2 text-sm text-[#7f5b56] leading-relaxed">{selectedCard.card.description}</p>

                                        <div className="mt-4 space-y-2">
                                            {effectLines.map(line => (
                                                <div key={line} className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-3 py-2 text-sm font-semibold text-[#6b3141]">{line}</div>
                                            ))}
                                        </div>

                                        <div className="mt-4 text-sm text-[#8f6c67]">{alreadyOwned ? 'Carta ja comprada.' : !hasLevel ? `Nivel ${selectedCard.card.minLevel} necessario.` : !canAfford ? 'Diamantes insuficientes.' : selectedCard.tagline}</div>
                                        <button
                                            onClick={() => {
                                                requestCardPurchase(selectedCard, true);
                                            }}
                                            disabled={alreadyOwned || !canAfford || !hasLevel}
                                            className={`mt-4 w-full rounded-xl px-5 py-3 font-black uppercase tracking-[0.16em] transition-all ${alreadyOwned || !canAfford || !hasLevel ? 'bg-[#e9d7c2] text-[#8f6c67] cursor-not-allowed border border-[#dcc0aa]' : 'bg-[#b84a63] text-white hover:bg-[#a53d56] border border-[#a53d56]'}`}
                                        >
                                            Comprar carta
                                        </button>
                                    </div>
                                );
                            })() : selectedType === 'item' && selectedItem ? (() => {
                                const canAfford = player.diamonds >= selectedItem.cost;
                                const hasLevel = player.level >= selectedItem.item.minLevel;
                                const ownedQty = player.inventory[selectedItem.item.id] || 0;
                                const relicMeta = getAlchemistRelicMeta(selectedItem.item);

                                return (
                                    <div className="rounded-[20px] border border-[#cfab91] bg-[#fff7ed] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700">
                                                <Sparkles size={12} /> {relicMeta.title}
                                            </div>
                                            <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-1.5 text-center">
                                                <div className="text-[9px] uppercase tracking-[0.2em] text-[#9a7068]">Preco</div>
                                                <div className="text-lg font-black text-[#346c7f]">{selectedItem.cost} 💎</div>
                                            </div>
                                        </div>

                                        <h4 className="mt-3 text-2xl font-black text-[#6b3141]">{selectedItem.item.name}</h4>
                                        <p className="mt-2 text-sm text-[#7f5b56] leading-relaxed">{selectedItem.item.description}</p>

                                        <div className="mt-3 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-sm font-black text-[#6b3141]">
                                            Estoque atual: x{ownedQty}
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            {relicMeta.lines.map(line => (
                                                <div key={line} className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-3 py-2 text-sm font-semibold text-[#6b3141]">{line}</div>
                                            ))}
                                        </div>

                                        <div className="mt-4 text-sm text-[#8f6c67]">{!hasLevel ? `Nivel ${selectedItem.item.minLevel} necessario.` : !canAfford ? 'Diamantes insuficientes.' : relicMeta.footer}</div>
                                        <button
                                            onClick={() => {
                                                requestItemPurchase(selectedItem, true);
                                            }}
                                            disabled={!canAfford || !hasLevel}
                                            className={`mt-4 w-full rounded-xl px-5 py-3 font-black uppercase tracking-[0.16em] transition-all ${!canAfford || !hasLevel ? 'bg-[#e9d7c2] text-[#8f6c67] cursor-not-allowed border border-[#dcc0aa]' : 'bg-[#3b6580] text-white hover:bg-[#34586f] border border-[#34586f]'}`}
                                        >
                                            Comprar reliquia
                                        </button>
                                    </div>
                                );
                            })() : (
                                <div className="rounded-[20px] border border-dashed border-[#cfab91] bg-[#f4e7d5] px-6 py-10 text-center text-[#8f6c67]">
                                    Nenhum item disponivel no estoque.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {pendingCardPurchase && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4">
                    <div className="w-full max-w-sm rounded-[22px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_70px_rgba(107,49,65,0.24)] overflow-hidden" onClick={(event) => event.stopPropagation()}>
                        <div className="border-b border-[#dcc0aa] bg-[#6b3141] px-5 py-4 text-center">
                            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#f6eadc]">Confirmar compra</div>
                            <h3 className="mt-1 text-xl font-black text-white">{pendingCardPurchase.card.name}</h3>
                            <p className="mt-1 text-sm text-[#dcc0aa]">Essa carta e compra unica no alquimista e sera adicionada as cartas do heroi.</p>
                        </div>
                        <div className="p-4">
                            <div className="mb-3 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-sm font-black text-[#346c7f]">
                                Custo: {pendingCardPurchase.cost} diamantes
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        setPendingCardPurchase(null);
                                        setCloseMobileAfterCardPurchase(false);
                                    }}
                                    className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmCardPurchase}
                                    className="rounded-xl border border-[#a53d56] bg-[#b84a63] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#a53d56]"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {pendingItemPurchase && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4">
                    <div className="w-full max-w-sm rounded-[22px] border border-[#96bccb] bg-[#eef8fe] shadow-[0_24px_70px_rgba(47,98,116,0.24)] overflow-hidden" onClick={(event) => event.stopPropagation()}>
                        <div className="border-b border-[#c4deea] bg-[linear-gradient(135deg,#2b6878,#66b8d2)] px-5 py-4 text-center">
                            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#f2fbff]">Confirmar compra</div>
                            <h3 className="mt-1 text-xl font-black text-white">{pendingItemPurchase.item.name}</h3>
                            <p className="mt-1 text-sm text-[#e4f6ff]">A relíquia será adicionada ao inventário e pode ser acumulada.</p>
                        </div>
                        <div className="p-4">
                            <div className="mb-3 rounded-xl border border-[#96bccb] bg-white px-3 py-2 text-sm font-black text-[#2f6274]">
                                Custo: {pendingItemPurchase.cost} diamantes
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        setPendingItemPurchase(null);
                                        setCloseMobileAfterItemPurchase(false);
                                    }}
                                    className="rounded-xl border border-[#96bccb] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#2f6274] transition-colors hover:bg-[#e8f6fc]"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmItemPurchase}
                                    className="rounded-xl border border-[#2f6274] bg-[#2b6878] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#357b8e]"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const DungeonResultScreen: React.FC<{ result: DungeonResult, onContinue: () => void }> = ({ result, onContinue }) => {
    const rewardItems = Object.entries(result.rewards.drops)
        .map(([itemId, quantity]) => ({ item: ALL_ITEMS.find(entry => entry.id === itemId), quantity }))
        .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry.item));
    const isPositiveOutcome = result.outcome !== 'defeat';
    const title = result.outcome === 'victory' ? 'Dungeon Concluída' : result.outcome === 'withdrawal' ? 'Retirada Segura' : 'Dungeon Fracassada';
    const badgeLabel = result.outcome === 'withdrawal' ? 'Extração' : 'Dungeon';
    const frameClasses = isPositiveOutcome
        ? 'border-[#7fb0d3] bg-[#e7f4ff] shadow-[0_30px_120px_rgba(31,79,120,0.24)]'
        : 'border-[#d3a0a0] bg-[#fdecec] shadow-[0_30px_120px_rgba(120,31,31,0.26)]';
    const headerClasses = isPositiveOutcome ? 'bg-[#1f4f78]' : 'bg-[#7a2525]';
    const headerTextClass = isPositiveOutcome ? 'text-[#bfdcf2]' : 'text-[#f0c5c5]';
    const statCardClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#dff0ff]' : 'border-[#dfb3b3] bg-[#fbe1e1]';
    const statLabelClass = isPositiveOutcome ? 'text-[#557f9f]' : 'text-[#9f5757]';
    const statValueClass = isPositiveOutcome ? 'text-[#214f70]' : 'text-[#7a2525]';
    const lootPanelClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#dff0ff]' : 'border-[#dfb3b3] bg-[#fbe1e1]';
    const lootChipClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff] text-[#4f7694]' : 'border-[#dfb3b3] bg-[#fdecec] text-[#9f5757]';
    const lootItemClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff]' : 'border-[#dfb3b3] bg-[#fdecec]';
    const lootItemInnerClasses = isPositiveOutcome ? 'border-[#b5d2e8] bg-[#dff0ff]' : 'border-[#ebc3c3] bg-[#fbe1e1]';
    const lootItemTextClass = isPositiveOutcome ? 'text-[#214f70]' : 'text-[#7a2525]';
    const emptyLootClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff] text-[#4f7694]' : 'border-[#dfb3b3] bg-[#fdecec] text-[#9f5757]';

    return (
        <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
            <div className={`w-full max-w-4xl rounded-[28px] border overflow-hidden ${frameClasses}`}>
                <div className={`px-6 py-5 sm:px-8 sm:py-6 text-center ${headerClasses}`}>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#e6f4ff]">
                        {isPositiveOutcome ? <Sparkles size={14} /> : <AlertTriangle size={14} />} {badgeLabel}
                    </div>
                    <h2 className="mt-4 text-3xl sm:text-4xl font-black text-white">{title}</h2>
                    <p className={`mt-2 text-sm sm:text-base ${headerTextClass}`}>{result.reason}</p>
                    {result.outcome === 'victory' && result.nextEvolution !== undefined && result.nextTotalMonsters !== undefined && (
                        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs sm:text-sm font-black text-[#e6f4ff]">
                            <span>Próxima evolução: {result.nextEvolution}</span>
                            <span className="text-[#bfdcf2]/70">•</span>
                            <span>{result.nextTotalMonsters} encontros até o chefão</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-6 sm:p-8">
                    <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
                        <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Encontros</div>
                        <div className={`text-2xl font-black ${statValueClass}`}>{result.rewards.clearedMonsters}<span className={`text-sm ${statLabelClass}`}>/{result.rewards.totalMonsters}</span></div>
                    </div>
                    <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
                        <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Ouro</div>
                        <div className="flex items-center gap-1.5 text-2xl font-black text-amber-700">
                            <GameAssetIcon name="coin" size={18} />
                            {isPositiveOutcome ? '+' : ''}{result.rewards.gold}
                        </div>
                    </div>
                    <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
                        <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>XP</div>
                        <div className={`flex items-center gap-1.5 text-2xl font-black ${isPositiveOutcome ? 'text-[#2d5f85]' : 'text-[#8f3535]'}`}>
                            <Zap size={16} className="shrink-0" />
                            {isPositiveOutcome ? '+' : ''}{result.rewards.xp}
                        </div>
                    </div>
                    <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
                        <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Diamantes</div>
                        <div className="flex items-center gap-1.5 text-2xl font-black text-[#346c7f]">
                            <GameAssetIcon name="diamond" size={18} />
                            {isPositiveOutcome ? '+' : ''}{result.rewards.diamonds}
                        </div>
                    </div>
                    <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
                        <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Chefão</div>
                        <div className={`text-lg font-black ${result.rewards.bossDefeated ? (isPositiveOutcome ? 'text-[#2c6a92]' : 'text-[#9f5757]') : statLabelClass}`}>{result.rewards.bossDefeated ? '✓ Derrotado' : '— Intacto'}</div>
                    </div>
                </div>

                <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                    <div className={`rounded-2xl border p-5 ${lootPanelClasses}`}>
                        <div className={`text-[11px] font-black uppercase tracking-[0.3em] mb-3 ${statLabelClass}`}>
                            {isPositiveOutcome ? 'Espólio da dungeon' : 'Itens acumulados'}
                            {rewardItems.length > 0 && <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] ${lootChipClasses}`}>{rewardItems.length}</span>}
                        </div>
                        {rewardItems.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-[28vh] overflow-y-auto pr-1">
                                {rewardItems.map(({ item, quantity }) => (
                                    <div key={item.id} className={`flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1.5 shrink-0 ${lootItemClasses}`}>
                                        <div className={`h-7 w-7 rounded-full border flex items-center justify-center text-sm leading-none ${lootItemInnerClasses}`}>{item.icon}</div>
                                        <span className={`text-sm font-black ${lootItemTextClass}`}>{item.name}</span>
                                        {quantity > 1 && <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-black ${lootChipClasses}`}>×{quantity}</span>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={`rounded-2xl border border-dashed px-6 py-8 text-center ${emptyLootClasses}`}>Nenhum item ou material foi acumulado.</div>
                        )}
                    </div>

                    <button onClick={onContinue} className={`mt-6 w-full py-4 rounded-xl font-black text-lg text-white transition-all ${isPositiveOutcome ? 'bg-[#2b6b96] hover:bg-[#327aa9] shadow-[0_12px_30px_rgba(43,107,150,0.35)]' : 'bg-[#2c5f82] hover:bg-[#346f97] shadow-[0_12px_30px_rgba(44,95,130,0.35)]'}`}>
                        {result.outcome === 'victory' ? 'Receber espólio e continuar' : result.outcome === 'withdrawal' ? 'Receber espólio e voltar' : 'Voltar para o acampamento'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const BossVictoryModal: React.FC<{
    context: BossVictoryContext;
    narration?: string;
    onContinue: () => void;
    onExit: () => void;
}> = ({ context, narration, onContinue, onExit }) => {
    const rewardItems = Object.entries(context.rewards?.drops ?? {})
        .map(([itemId, quantity]) => ({ item: ALL_ITEMS.find(entry => entry.id === itemId), quantity }))
        .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry.item));

    const isDungeon = context.mode === 'dungeon';
    const newlyUnlockedShopRarity = !isDungeon
        ? (context.newlyUnlockedShopRarity ?? getNewlyUnlockedShopRarityByStage(context.nextStage ?? 0))
        : null;
    const unlockBadgeClass = newlyUnlockedShopRarity === 'gold'
        ? 'border-[#dcb570] bg-[#f3e3c3] text-[#7a5733]'
        : 'border-[#b8becb] bg-[#e9edf4] text-[#4f5d76]';
    const unlockLabel = newlyUnlockedShopRarity === 'gold' ? 'Lendario' : 'Raro';

    return (
        <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
            <div className="w-full max-w-4xl rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] overflow-hidden shadow-[0_30px_120px_rgba(107,49,65,0.22)]">
                <div className="bg-[#6b3141] px-6 py-5 sm:px-8 sm:py-6 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#f6eadc]">
                        <Crown size={14} /> Chefao derrotado
                    </div>
                    <h2 className="mt-4 text-3xl sm:text-4xl font-black text-white">
                        {isDungeon ? 'Dungeon concluida' : 'Fase concluida'}
                    </h2>
                    <p className="mt-2 text-sm sm:text-base text-[#dcc0aa]">
                        {isDungeon
                            ? `${context.bossName} caiu. Voce domina a dungeon e decide seu proximo passo.`
                            : `${context.bossName} foi vencido. Sua proxima fase esta liberada.`}
                    </p>
                    {narration && !isDungeon && (
                        <p className="mt-2 text-sm text-[#f6eadc] italic">&ldquo;{narration}&rdquo;</p>
                    )}
                </div>

                {!isDungeon && (
                    <div className="px-6 py-5 sm:px-8 sm:py-6">
                        <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-5 py-4 text-center">
                            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#9a7068]">Proxima fase</div>
                            <div className="mt-1 text-4xl font-black text-[#6b3141]">{context.nextStage ?? '-'}</div>
                            <div className="mt-1 text-xs text-[#8f6c67]">Inimigos mais fortes aguardam</div>
                        </div>
                        {newlyUnlockedShopRarity && (
                            <div className="mt-3 rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7068]">Mercador</div>
                                        <div className="mt-1 flex items-center gap-2 text-sm font-black text-[#6b3141]">
                                            <GameAssetIcon name="chest" size={18} />
                                            Novos itens liberados no mercador
                                        </div>
                                    </div>
                                    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${unlockBadgeClass}`}>
                                        {unlockLabel}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {isDungeon && context.rewards && (
                    <div className="px-6 py-5 sm:px-8 sm:py-6 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Encontros</div>
                                <div className="text-2xl font-black text-[#6b3141]">{context.rewards.clearedMonsters}<span className="text-sm text-[#9a7068]">/{context.rewards.totalMonsters}</span></div>
                            </div>
                            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Ouro</div>
                                <div className="flex items-center gap-1.5 text-2xl font-black text-amber-700">
                                    <GameAssetIcon name="coin" size={18} />+{context.rewards.gold}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">XP</div>
                                <div className="flex items-center gap-1.5 text-2xl font-black text-[#7d3d4d]">
                                    <Zap size={16} className="shrink-0" />+{context.rewards.xp}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Diamantes</div>
                                <div className="flex items-center gap-1.5 text-2xl font-black text-[#346c7f]">
                                    <GameAssetIcon name="diamond" size={18} />+{context.rewards.diamonds}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Prox. evolucao</div>
                                <div className="text-lg font-black text-[#4d7a96]">Nv. {context.nextEvolution ?? context.rewards.evolution}</div>
                            </div>
                        </div>

                        {context.nextTotalMonsters !== undefined && (
                            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 text-sm font-black text-[#6b3141] text-center">
                                {context.nextTotalMonsters} encontros para o proximo chefao
                            </div>
                        )}

                        <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-[#9a7068] mb-3">
                                Espolio conquistado
                                {rewardItems.length > 0 && <span className="ml-2 rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2 py-0.5 text-[10px] text-[#8f6c67]">{rewardItems.length}</span>}
                            </div>
                            {rewardItems.length > 0 ? (
                                <div className="flex flex-wrap gap-2 max-h-[22vh] overflow-y-auto pr-1">
                                    {rewardItems.map(({ item, quantity }) => (
                                        <div key={item.id} className="flex items-center gap-1.5 rounded-full border border-[#cfab91] bg-[#f7ecdd] pl-1.5 pr-3 py-1.5 shrink-0">
                                            <div className="h-7 w-7 rounded-full border border-[#dcc0aa] bg-[#f4e5d4] flex items-center justify-center text-sm leading-none">{item.icon}</div>
                                            <span className="text-sm font-black text-[#6b3141]">{item.name}</span>
                                            {quantity > 1 && <span className="rounded-full border border-[#cfab91] bg-[#f4e5d4] px-1.5 py-0.5 text-[10px] font-black text-[#8f6c67]">x{quantity}</span>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-[#cfab91] bg-[#f7ecdd] px-6 py-6 text-center text-[#8f6c67]">Nenhum item adicional foi acumulado.</div>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 px-6 pb-6 sm:px-8 sm:pb-8">
                    <button
                        onClick={onExit}
                        className="flex items-center justify-center gap-2 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
                    >
                        {isDungeon ? <LogOut size={15} /> : <Home size={15} />}
                        Descansar
                    </button>
                    <button
                        onClick={onContinue}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[#b87a3a] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(184,122,58,0.3)] transition-all hover:bg-[#c88a4a]"
                    >
                        <Sword size={15} /> Continuar
                    </button>
                </div>
            </div>
        </div>
    );
};

type ShopFilter = 'all' | 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs' | 'potion';

export const ShopScreen: React.FC<{ player: Player, items: Item[], huntStage: number, onBuy: (i: Item, quantity: number) => void, onSell: (i: Item, quantity: number) => void, onEquip: (i: Item) => void, onLeave: () => void }> = ({ player, items, huntStage, onBuy, onSell, onEquip, onLeave }) => {
    return <ShopMenuScreen player={player} items={items} huntStage={huntStage} onBuy={onBuy} onSell={onSell} onEquip={onEquip} onLeave={onLeave} />;
};

export const BattleHUD: React.FC<GameUIProps> = (props) => {
    const { player, enemy, turnState, logs, onAttack, onDefend, onChargeImpulse, onAbsorbImpulse, onSkill, onUseItem, enemyIntentPreview = null, onUnlockTalent, onResetTalents, currentNarration, gameState, shopItems, floatingTexts, onFlee, onStartBattle, stage, dungeonPhase = 1, killCount, onEquipItem, onUnequipItem, isDungeonRun, dungeonRewards, dungeonCleared = 0, dungeonTotal = 30, gameTime, restrictProfileToStatusOnly = false, limitBattleActionsToBasics = false, inventoryUnlocked = false, inventoryUnlockPromptActive = false, onAcknowledgeInventoryUnlock, cardsUnlockPromptActive = false, onAcknowledgeCardsUnlock, skillsUnlockPromptActive = false, onAcknowledgeSkillsUnlock, impulseUnlockPromptActive = null, onAcknowledgeImpulseUnlock, constellationUnlockPromptActive = false, onAcknowledgeConstellationUnlock, constellationRespecUnlockPromptActive = false, onAcknowledgeConstellationRespecUnlock, allowCardsInProfile = false, fleeUnlocked = false, showItemsAction = false, showSkillsAction = false, itemsUnlockPromptActive = false, onAcknowledgeItemsUnlock, fleeUnlockPromptActive = false, onAcknowledgeFleeUnlock, showDiamondHud = false, diamondUnlockPromptActive = false, onAcknowledgeDiamondUnlock, musicEnabled = true, sfxEnabled = true, renderQualityPreset = 'balanced', recommendedRenderQualityPreset = 'balanced', onUpdateBattleSettings } = props;
  const [activeBattleMenu, setActiveBattleMenu] = useState<'skills' | 'items' | null>(null);
  const [showProfile, setShowProfile] = useState(false);
    const [showBattleSettings, setShowBattleSettings] = useState(false);
    const [profileInitialTab, setProfileInitialTab] = useState<'overview' | 'cards' | 'skills' | 'constellation' | undefined>(undefined);
  const [showInventory, setShowInventory] = useState(false);
    const [returnToProfileOnInventoryClose, setReturnToProfileOnInventoryClose] = useState(false);
    const [inventoryInitialFilter, setInventoryInitialFilter] = useState<'all' | 'equipment' | 'potion' | 'material'>('all');
    const [showInventoryUnlockPrompt, setShowInventoryUnlockPrompt] = useState(false);
        const [showCardsUnlockPrompt, setShowCardsUnlockPrompt] = useState(false);
                const [showSkillsUnlockPrompt, setShowSkillsUnlockPrompt] = useState(false);
            const [showConstellationUnlockPrompt, setShowConstellationUnlockPrompt] = useState(false);
        const [showItemsUnlockPrompt, setShowItemsUnlockPrompt] = useState(false);
        const [showFleeUnlockPrompt, setShowFleeUnlockPrompt] = useState(false);
    const [showDiamondUnlockPrompt, setShowDiamondUnlockPrompt] = useState(false);
        const [showImpulseUnlockPromptLevel, setShowImpulseUnlockPromptLevel] = useState<number | null>(null);
    const [resumeBattleAfterInventoryPrompt, setResumeBattleAfterInventoryPrompt] = useState(false);
    const [showFleeConfirm, setShowFleeConfirm] = useState(false);
    const [showDungeonExtractConfirm, setShowDungeonExtractConfirm] = useState(false);
    const [pendingDungeonExtractItem, setPendingDungeonExtractItem] = useState<Item | null>(null);
    const [showDungeonLootPreview, setShowDungeonLootPreview] = useState(false);
    const [showBattleStats, setShowBattleStats] = useState(false);
    const [resourceDelta, setResourceDelta] = useState<number>(0);
    const [resourcePulse, setResourcePulse] = useState<'gain' | 'spend' | null>(null);
    const resourceDeltaTimeoutRef = useRef<number | null>(null);
    const battleActionsRef = useRef<HTMLDivElement | null>(null);
    const previousResourceRef = useRef(player.classResource.value);
    const showDiamondOnBattleHud = showDiamondHud;
    const currentPlayerClass = getPlayerClassById(player.classId);
    const usesMagicBasicAttack = shouldUseMagicBasicAttack(player.classId, player.equippedWeapon);
    const usesBowBasicAttack = shouldUseBowBasicAttack(player.classId, player.equippedWeapon);
    const classAccentColor = currentPlayerClass.visualProfile.secondaryColor;
    const classAccentDarkColor = darkenHexColor(classAccentColor, 0.24);
    const classHeaderColor = currentPlayerClass.visualProfile.secondaryColor;
    const classHeaderDarkColor = darkenHexColor(classHeaderColor, 0.24);
    const HeroClassIcon = HERO_CLASS_ICON[player.classId];
    const playerClassNamePt = CLASS_NAME_PT[player.classId] ?? currentPlayerClass.name;
    const classImpulseBaseColor = currentPlayerClass.visualProfile.auraColor ?? classAccentColor;
    const classImpulseBorderColor = currentPlayerClass.visualProfile.secondaryColor ?? classAccentColor;
    const impulseCapacity = getImpulseCapacityByLevel(player.level);
    const impulseUnlocked = impulseCapacity > 0;
        const hasConstellationUnlocked = player.talentPoints > 0 || player.unlockedTalentNodeIds.length > 0;
    const openProfileModal = (initialTab?: 'overview' | 'cards' | 'skills' | 'constellation') => {
        setProfileInitialTab(initialTab);
        if (!showProfile) {
            uiSfx.play('modal_open');
        }
        setShowProfile(true);
    };
    const openHeroStatusFromCard = () => {
        openProfileModal('overview');
    };
    const handleHeroCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openHeroStatusFromCard();
        }
    };
    const closeProfileModal = () => {
        if (!showProfile) {
            return;
        }
        setShowProfile(false);
        uiSfx.play('modal_close');
    };
    const openInventoryModal = (initialFilter: 'all' | 'equipment' | 'potion' | 'material' = 'all', fromProfile = false) => {
        setInventoryInitialFilter(initialFilter);
        setReturnToProfileOnInventoryClose(fromProfile);
        if (!showInventory) {
            uiSfx.play('modal_open');
        }
        setShowInventory(true);
    };
    const closeInventoryModal = () => {
        if (showInventory) {
            uiSfx.play('modal_close');
        }
        setShowInventory(false);
        if (resumeBattleAfterInventoryPrompt) {
            setResumeBattleAfterInventoryPrompt(false);
            onStartBattle(false);
        }
        if (returnToProfileOnInventoryClose) {
            setReturnToProfileOnInventoryClose(false);
            uiSfx.play('modal_open');
            setShowProfile(true);
        }
    };
    const openBattleSettingsModal = () => {
        if (!showBattleSettings) {
            uiSfx.play('modal_open');
        }
        setShowBattleSettings(true);
    };
    const closeBattleSettingsModal = () => {
        if (!showBattleSettings) {
            return;
        }
        setShowBattleSettings(false);
        uiSfx.play('modal_close');
    };
    const toggleMusic = () => {
        onUpdateBattleSettings?.({ musicEnabled: !musicEnabled });
    };
    const toggleSfx = () => {
        onUpdateBattleSettings?.({ sfxEnabled: !sfxEnabled });
    };
    const changeRenderPreset = (preset: RenderQualityPreset) => {
        onUpdateBattleSettings?.({ renderQualityPreset: preset });
    };
  const isPlayerTurn = turnState === TurnState.PLAYER_INPUT;
    const enemyClassId = enemy?.enemyClassId ?? 'knight';
    const EnemyClassIcon = HERO_CLASS_ICON[enemyClassId];
    const intentMetaByType: Record<NonNullable<GameUIProps['enemyIntentPreview']>['type'], { icon: string; color: string; label: string }> = {
        attack: { icon: '⚔', color: '#ef4444', label: 'Ataque' },
        defend: { icon: '🛡', color: '#60a5fa', label: 'Defesa' },
        impulse: { icon: '⚡', color: '#f59e0b', label: 'Impulso' },
        skill: { icon: '✨', color: '#a855f7', label: 'Habilidade' },
        item: { icon: '💊', color: '#22c55e', label: 'Item' },
    };
    void enemyIntentPreview;
    void intentMetaByType;
    const impulseButtonGlowColor = player.impulsoAtivo >= 3
        ? '#3b82f6'
        : player.impulsoAtivo === 2
            ? '#a855f7'
            : player.impulsoAtivo === 1
                ? '#ef4444'
                : classImpulseBaseColor;
    const absorbGlowColor = player.impulsoAtivo >= 3 ? '#3b82f6' : player.impulsoAtivo === 2 ? '#a855f7' : '#ef4444';
    const currentImpulseFxColor = player.impulsoAtivo >= 3
        ? '#3b82f6'
        : player.impulsoAtivo === 2
            ? '#a855f7'
            : player.impulsoAtivo === 1
                ? '#ef4444'
                : classImpulseBaseColor;
    const impulseReserveColors = [classImpulseBaseColor, classImpulseBaseColor, classImpulseBaseColor];
    const buttonsEnergized = player.impulsoAtivo > 0;
    const enemyCardToneClass = enemy?.isBoss
        ? 'border-[3px] border-rose-400 bg-[linear-gradient(135deg,rgba(255,238,238,0.96),rgba(255,226,226,0.92))] shadow-[0_12px_30px_rgba(190,24,93,0.28)] ring-1 ring-rose-300/60'
        : enemy?.isSubBoss
            ? 'border-[3px] border-amber-400 bg-[linear-gradient(135deg,rgba(255,247,230,0.96),rgba(255,237,201,0.92))] shadow-[0_12px_28px_rgba(180,83,9,0.24)] ring-1 ring-amber-300/60'
            : 'border-[#cfab91] bg-[#f7ecdd]/94 shadow-xl';
    const enemyLevelBadgeToneClass = enemy?.isBoss
        ? 'border-rose-300 bg-rose-100 text-rose-700'
        : enemy?.isSubBoss
            ? 'border-amber-300 bg-amber-100 text-amber-700'
            : 'border-[#d69f69] bg-[#fff1dc] text-[#8d5e29]';
    const enemyUsesManaSkills = Boolean(enemy?.skillSet.some((skill) => skill.manaCost > 0));
    const canLeaveFreely = !isDungeonRun && killCount >= 10;
    const dungeonRewardItems = Object.entries(dungeonRewards?.drops ?? {})
            .map(([itemId, quantity]) => ({ item: ALL_ITEMS.find(entry => entry.id === itemId), quantity }))
            .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry.item));

  // Filter inventory for usable items (potions)
  const usableItems = shopItems.filter(i => i.type === 'potion' && (player.inventory[i.id] || 0) > 0);
    const manaPotionIds = new Set(['pot_2', 'pot_mana_2', 'pot_mana_3', 'pot_dg_mana']);
    const mixedPotionRecovery: Record<string, { hp: number; mp: number }> = {
            pot_mix_1: { hp: 35, mp: 20 },
            pot_mix_2: { hp: 80, mp: 50 },
    };
  const heroBuffEntries = [
      player.buffs.atkTurns > 0 ? {
          key: 'atk',
          icon: <Sword size={12} className="text-[#b83a4b]" />,
          label: `ATK +${(player.buffs.atkMod * 100).toFixed(0)}% • ${player.buffs.atkTurns}t`,
          chipClass: 'border-[#e79aa7] bg-[#fbe3e8] text-[#8f253c]',
      } : null,
      player.buffs.defTurns > 0 ? {
          key: 'def',
          icon: <Shield size={12} className="text-[#4d6780]" />,
          label: `DEF +${(player.buffs.defMod * 100).toFixed(0)}% • ${player.buffs.defTurns}t`,
          chipClass: 'border-[#9ec2cf] bg-[#e6f3f8] text-[#2f6274]',
      } : null,
      player.buffs.autoGuardTurns > 0 ? {
          key: 'auto-guard',
          icon: <Shield size={12} className="text-[#2f6274]" />,
          label: `Defesa automatica • ${player.buffs.autoGuardTurns}t`,
          chipClass: 'border-[#9ec2cf] bg-[#e6f3f8] text-[#2f6274]',
      } : null,
      player.buffs.perfectEvadeTurns > 0 ? {
          key: 'evd',
          icon: <Sparkles size={12} className="text-[#7c4c76]" />,
          label: `Evasao perfeita • ${player.buffs.perfectEvadeTurns}t`,
          chipClass: 'border-[#ccb0dd] bg-[#f1e8f7] text-[#6a3f82]',
      } : null,
      player.buffs.doubleAttackTurns > 0 ? {
          key: 'x2',
          icon: <Sword size={12} className="text-[#b83a4b]" />,
          label: `Ataque duplo • ${player.buffs.doubleAttackTurns}t`,
          chipClass: 'border-[#e8bc89] bg-[#fcecd7] text-[#9a6127]',
      } : null,
      (player.isDefending || player.buffs.autoGuardTurns > 0) ? {
          key: 'counter-chance',
          icon: <Sword size={12} className="text-[#b83a4b]" />,
          label: (() => {
              const counterCapByClass: Record<Player['classId'], number> = {
                  knight: 0.25,
                  barbarian: 0.25,
                  mage: 0.3,
                  ranger: 0.4,
                  rogue: 0.4,
              };
              const bonuses = getTalentBonuses(player);
              const talentBonus = Math.max(0, Math.min(0.12, bonuses.counterOnDefendChance));
              const attributeBonus = (Math.max(0, player.stats.def) * 0.0025)
                  + (Math.max(0, player.stats.speed) * 0.002)
                  + (Math.max(0, player.stats.luck) * 0.0015);
              const cardBonus = Math.max(0, player.cardBonuses.counterAttackChanceBonus ?? 0);
              const openingBonus = player.buffs.counterChanceBoostTurns > 0 ? Math.max(0, player.buffs.counterChanceBoost) : 0;
              const classCap = counterCapByClass[player.classId] ?? 0.3;
              const chance = Math.min(classCap, 0.06 + talentBonus + attributeBonus + cardBonus + openingBonus);
              return `Contra-ataque ${(chance * 100).toFixed(0)}%`;
          })(),
          chipClass: 'border-[#e79aa7] bg-[#fbe3e8] text-[#8f253c]',
      } : null,
    ].filter(Boolean) as Array<{ key: string; icon: React.ReactElement; label: string; chipClass: string }>;
  const describeBattleSkill = (skill: Skill) => {
      if (skill.id === 'skl_11') {
          return 'Ativa defesa automatica por 3 turnos';
      }
      const statusText = skill.statusEffect
        ? ` • aplica ${skill.statusEffect.kind}`
        : '';
      const resourceText = skill.resourceEffect
        ? ` • ${skill.resourceEffect.cost ? `consome ${skill.resourceEffect.consumeAll ? 'toda' : skill.resourceEffect.cost} ${skill.resourceLabel || player.classResource.name}` : `gera ${skill.resourceEffect.gain || 0} ${skill.resourceLabel || player.classResource.name}`}`
        : '';
      if (skill.type === 'heal') {
          return `Cura ${Math.round(skill.damageMult * 100)}% da vida maxima${resourceText}`;
      }

      return `${skill.type === 'magic' ? 'Dano magico' : 'Dano fisico'} x${skill.damageMult.toFixed(1)}${skill.type === 'magic' ? ' • menor chance de desvio' : ''}${statusText}${resourceText}`;
  };

  const describeBattleItem = (item: Item) => {
      if (item.id === 'pot_dg_recall') return 'Retira voce da dungeon e preserva todo o espolio acumulado';
      if (item.id === 'pot_alc_phantom_veil') return 'Ativa evasao perfeita por 4 turnos';
    if (item.id === 'pot_alc_twin_fang') return 'Duplica ataques basicos e habilidades fisicas por 6 turnos';
      if (item.id === 'pot_atk') return `Aumenta ataque em ${Math.round(item.value * 100)}% por ${item.duration || 3} turnos`;
      if (item.id === 'pot_def') return `Aumenta defesa em ${Math.round(item.value * 100)}% por ${item.duration || 3} turnos`;
      if (item.id === 'pot_war_sigil' || item.id === 'pot_overclock') return `Aumenta ataque e defesa em ${Math.round(item.value * 100)}% por ${item.duration || 2} turnos`;

            const mixed = mixedPotionRecovery[item.id];
            if (mixed) return `Recupera ${mixed.hp} HP e ${mixed.mp} MP`;

            if (manaPotionIds.has(item.id)) return `Recupera ${item.value} MP`;
      return `Recupera ${item.value} HP`;
  };

  useEffect(() => {
      const current = player.classResource.value;
      const previous = previousResourceRef.current;
      const delta = current - previous;

      if (delta !== 0) {
          setResourceDelta(delta);
          setResourcePulse(delta > 0 ? 'gain' : 'spend');

          if (resourceDeltaTimeoutRef.current !== null) {
              window.clearTimeout(resourceDeltaTimeoutRef.current);
          }

          resourceDeltaTimeoutRef.current = window.setTimeout(() => {
              setResourceDelta(0);
              setResourcePulse(null);
              resourceDeltaTimeoutRef.current = null;
          }, 800);
      }

      previousResourceRef.current = current;
  }, [player.classResource.value]);

  useEffect(() => () => {
      if (resourceDeltaTimeoutRef.current !== null) {
          window.clearTimeout(resourceDeltaTimeoutRef.current);
      }
  }, []);

  useEffect(() => {
      if (!activeBattleMenu) {
          return;
      }

      if (activeBattleMenu === 'skills' && !showSkillsAction) {
          setActiveBattleMenu(null);
      }

      if (activeBattleMenu === 'items' && !showItemsAction) {
          setActiveBattleMenu(null);
      }

      if (limitBattleActionsToBasics) {
          setActiveBattleMenu(null);
      }
  }, [activeBattleMenu, limitBattleActionsToBasics, showItemsAction, showSkillsAction]);

  useEffect(() => {
      if (!activeBattleMenu) {
          return;
      }

      const closeOnOutsideInteraction = (event: PointerEvent) => {
          const target = event.target;
          if (!(target instanceof Node)) {
              return;
          }
          if (battleActionsRef.current?.contains(target)) {
              return;
          }
          setActiveBattleMenu(null);
      };

      const closeOnEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
              setActiveBattleMenu(null);
          }
      };

      window.addEventListener('pointerdown', closeOnOutsideInteraction);
      window.addEventListener('keydown', closeOnEscape);

      return () => {
          window.removeEventListener('pointerdown', closeOnOutsideInteraction);
          window.removeEventListener('keydown', closeOnEscape);
      };
  }, [activeBattleMenu]);

  useEffect(() => {
      if (!showBattleSettings) {
          return;
      }

      const closeOnEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
              closeBattleSettingsModal();
          }
      };

      window.addEventListener('keydown', closeOnEscape);
      return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showBattleSettings]);

  useEffect(() => {
      if (inventoryUnlockPromptActive) {
          setShowInventoryUnlockPrompt(true);
      }
  }, [inventoryUnlockPromptActive]);

  useEffect(() => {
      if (cardsUnlockPromptActive) {
          setShowCardsUnlockPrompt(true);
      }
  }, [cardsUnlockPromptActive]);

  useEffect(() => {
      if (skillsUnlockPromptActive) {
          setShowSkillsUnlockPrompt(true);
      }
  }, [skillsUnlockPromptActive]);

  useEffect(() => {
      if (impulseUnlockPromptActive !== null) {
          setShowImpulseUnlockPromptLevel(impulseUnlockPromptActive);
      }
  }, [impulseUnlockPromptActive]);

  useEffect(() => {
      if (constellationUnlockPromptActive) {
          setShowConstellationUnlockPrompt(true);
      }
  }, [constellationUnlockPromptActive]);

  useEffect(() => {
      if (itemsUnlockPromptActive) {
          setShowItemsUnlockPrompt(true);
      }
  }, [itemsUnlockPromptActive]);

  useEffect(() => {
      if (fleeUnlockPromptActive) {
          setShowFleeUnlockPrompt(true);
      }
  }, [fleeUnlockPromptActive]);

  useEffect(() => {
      if (diamondUnlockPromptActive) {
          setShowDiamondUnlockPrompt(true);
      }
  }, [diamondUnlockPromptActive]);

  useEffect(() => {
      if (!showInventoryUnlockPrompt && !showCardsUnlockPrompt && !showSkillsUnlockPrompt && !showImpulseUnlockPromptLevel && !showConstellationUnlockPrompt && !showItemsUnlockPrompt && !showFleeUnlockPrompt && !showDiamondUnlockPrompt) {
          return;
      }

      const handleBlockEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
          }
      };

      window.addEventListener('keydown', handleBlockEscape, true);
      return () => window.removeEventListener('keydown', handleBlockEscape, true);
    }, [showCardsUnlockPrompt, showConstellationUnlockPrompt, showInventoryUnlockPrompt, showSkillsUnlockPrompt, showImpulseUnlockPromptLevel, showItemsUnlockPrompt, showFleeUnlockPrompt, showDiamondUnlockPrompt]);

    return (
        <div className="battle-hud-root absolute inset-0 z-10 flex flex-col justify-between p-2 sm:p-4 pointer-events-none safe-bottom">
            <style>{`
                .battle-hud-root .backdrop-blur-sm,
                .battle-hud-root .backdrop-blur-md,
                .battle-hud-root .backdrop-blur,
                .battle-hud-root .backdrop-blur-\[2px\] {
                    -webkit-backdrop-filter: none !important;
                    backdrop-filter: none !important;
                }
            `}</style>
      <AnimatedModal open={showBattleSettings}>
          {(isClosing) => (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 pointer-events-auto p-4" onClick={closeBattleSettingsModal}>
                  <div className={`w-full max-w-xs rounded-[20px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_70px_rgba(107,49,65,0.26)] overflow-hidden transition-all duration-200 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`} onClick={(event) => event.stopPropagation()}>
                      <div className="bg-[#6b3141] px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                              <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#dcc0aa]">Configuracao</div>
                                  <h3 className="mt-1 text-lg font-black text-white">Batalha</h3>
                              </div>
                              <button onClick={closeBattleSettingsModal} className="rounded-lg border border-white/25 bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20" aria-label="Fechar configuracoes">
                                  <X size={14} />
                              </button>
                          </div>
                      </div>

                      <div className="space-y-3 p-4">
                          <div className="grid grid-cols-2 gap-2">
                              <button
                                  onClick={toggleMusic}
                                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${musicEnabled ? 'border-[#8eb4c0] bg-[#eaf6fb]' : 'border-[#cfab91] bg-[#f4e5d4]'}`}
                              >
                                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8f6c67]">Musica</div>
                                  <div className="mt-0.5 text-sm font-black text-[#6b3141]">{musicEnabled ? 'Ligada' : 'Desligada'}</div>
                              </button>
                              <button
                                  onClick={toggleSfx}
                                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${sfxEnabled ? 'border-[#8eb4c0] bg-[#eaf6fb]' : 'border-[#cfab91] bg-[#f4e5d4]'}`}
                              >
                                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8f6c67]">Efeitos</div>
                                  <div className="mt-0.5 text-sm font-black text-[#6b3141]">{sfxEnabled ? 'Ligados' : 'Desligados'}</div>
                              </button>
                          </div>

                          <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] p-2.5">
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8f6c67]">Qualidade grafica</div>
                              <div className="mt-2 grid grid-cols-3 gap-1.5">
                                  {(['performance', 'balanced', 'quality'] as RenderQualityPreset[]).map((preset) => {
                                      const selected = renderQualityPreset === preset;
                                      return (
                                          <button
                                              key={preset}
                                              onClick={() => changeRenderPreset(preset)}
                                              className={`rounded-lg border px-2 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition-colors ${selected ? 'border-[#2f6274] bg-[#2b6878] text-white' : 'border-[#cfab91] bg-[#f7ecdd] text-[#6b3141] hover:bg-[#efe0cd]'}`}
                                          >
                                              {getRenderPresetLabel(preset)}
                                          </button>
                                      );
                                  })}
                              </div>
                              <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8f6c67]">
                                  Recomendado: {getRenderPresetLabel(recommendedRenderQualityPreset)}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </AnimatedModal>
      {showFleeConfirm && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4" onClick={() => setShowFleeConfirm(false)}>
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.15)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="border-b border-[#dcc0aa] px-5 py-4 text-center">
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9a7068]">Retirada</div>
                      <h3 className="mt-1 text-2xl font-black text-[#6b3141]">{canLeaveFreely ? 'Sair da batalha?' : 'Fugir?'}</h3>
                      <p className="mt-3 text-sm text-[#7f5b56]">
                          {canLeaveFreely ? 'O chefão já foi liberado nesta fase. Você pode sair sem perder ouro.' : 'Na caça padrão você pode recuar, mas perde até 50 de ouro.'}
                      </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-4">
                      <button onClick={() => setShowFleeConfirm(false)} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
                          Ficar
                      </button>
                      <button onClick={() => { onFlee(); setShowFleeConfirm(false); }} className="rounded-xl border border-amber-500/30 bg-amber-600 px-4 py-3 font-black text-white transition-colors hover:bg-amber-500">
                          {canLeaveFreely ? 'Sair' : 'Fugir'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showDungeonExtractConfirm && pendingDungeonExtractItem && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4" onClick={() => { setShowDungeonExtractConfirm(false); setPendingDungeonExtractItem(null); }}>
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.15)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="border-b border-[#dcc0aa] px-5 py-4 text-center">
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9a7068]">Extração da dungeon</div>
                      <h3 className="mt-1 text-2xl font-black text-[#6b3141]">Usar {pendingDungeonExtractItem.name}?</h3>
                      <p className="mt-3 text-sm text-[#7f5b56]">Você vai sair da dungeon imediatamente e receber tudo que acumulou até este ponto.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-4">
                      <button onClick={() => { setShowDungeonExtractConfirm(false); setPendingDungeonExtractItem(null); }} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
                          Cancelar
                      </button>
                      <button onClick={() => { onUseItem(pendingDungeonExtractItem.id); setShowDungeonExtractConfirm(false); setPendingDungeonExtractItem(null); setActiveBattleMenu(null); }} className="rounded-xl border border-cyan-500/30 bg-cyan-600 px-4 py-3 font-black text-white transition-colors hover:bg-cyan-500">
                          Extrair
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showDungeonLootPreview && isDungeonRun && dungeonRewards && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4" onClick={() => setShowDungeonLootPreview(false)}>
              <div className="w-full max-w-lg rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-4 bg-[#6b3141] px-5 py-4">
                      <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#dcc0aa]">Espólio acumulado</div>
                          <h3 className="mt-0.5 text-lg font-black text-white">Ganhos na dungeon</h3>
                      </div>
                      <button onClick={() => setShowDungeonLootPreview(false)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f6eadc] transition-colors hover:bg-white/20">
                          Fechar
                      </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 p-4">
                      <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2.5">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-[#9a7068]">Monstros</div>
                          <div className="text-lg font-black text-[#6b3141]">{dungeonRewards.clearedMonsters}<span className="text-xs text-[#9a7068]">/{dungeonRewards.totalMonsters}</span></div>
                      </div>
                      <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2.5">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-[#9a7068]">Ouro</div>
                          <div className="flex items-center gap-1 text-lg font-black text-amber-700">
                              <GameAssetIcon name="coin" size={14} />+{dungeonRewards.gold}
                          </div>
                      </div>
                      <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2.5">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-[#9a7068]">Diamantes</div>
                          <div className="flex items-center gap-1 text-lg font-black text-[#346c7f]">
                              <GameAssetIcon name="diamond" size={14} />+{dungeonRewards.diamonds}
                          </div>
                      </div>
                      <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2.5">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-[#9a7068]">XP</div>
                          <div className="flex items-center gap-1 text-lg font-black text-[#7d3d4d]">
                              <Zap size={13} className="shrink-0" />+{dungeonRewards.xp}
                          </div>
                      </div>
                  </div>

                  <div className="px-4 pb-4">
                      <div className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] p-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9a7068] mb-2">
                              Itens
                              {dungeonRewardItems.length > 0 && <span className="ml-2 rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2 py-0.5 text-[9px] text-[#8f6c67]">{dungeonRewardItems.length}</span>}
                          </div>
                          {dungeonRewardItems.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 max-h-[30vh] overflow-y-auto pr-1">
                                  {dungeonRewardItems.map(({ item, quantity }) => (
                                      <div key={item.id} className="flex items-center gap-1 rounded-full border border-[#cfab91] bg-[#f7ecdd] pl-1 pr-2.5 py-1 shrink-0">
                                          <div className="h-6 w-6 rounded-full border border-[#dcc0aa] bg-[#f4e5d4] flex items-center justify-center text-xs leading-none">{item.icon}</div>
                                          <span className="text-xs font-black text-[#6b3141]">{item.name}</span>
                                          {quantity > 1 && <span className="rounded-full border border-[#cfab91] bg-[#f4e5d4] px-1.5 py-0.5 text-[9px] font-black text-[#8f6c67]">×{quantity}</span>}
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="rounded-xl border border-dashed border-[#cfab91] bg-[#f7ecdd] px-4 py-5 text-center text-xs text-[#8f6c67]">Nenhum item acumulado ainda.</div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showInventoryUnlockPrompt && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="bg-[#6b3141] px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f6eadc]">
                          <GameAssetIcon name="bag" size={14} /> Mochila
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">Mochila liberada</h3>
                      <p className="mt-2 text-sm text-[#dcc0aa]">Agora voce pode abrir a mochila para ver os itens que conquistou nas batalhas.</p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => {
                              setShowInventoryUnlockPrompt(false);
                              onAcknowledgeInventoryUnlock?.();
                              setResumeBattleAfterInventoryPrompt(true);
                              openInventoryModal('all');
                          }}
                          className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                      >
                          Ver mochila
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showCardsUnlockPrompt && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="bg-[#6b3141] px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f6eadc]">
                          <GameAssetIcon name="scroll" size={14} /> Cartas
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">Evolucao liberada</h3>
                      <p className="mt-2 text-sm text-[#dcc0aa]">Sua primeira carta foi registrada. Abra o perfil para acompanhar suas cartas de evolucao.</p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => {
                              setShowCardsUnlockPrompt(false);
                              onAcknowledgeCardsUnlock?.();
                              openProfileModal('cards');
                          }}
                          className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                      >
                          Ver cartas
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showSkillsUnlockPrompt && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="bg-[#6b3141] px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f6eadc]">
                          <Sparkles size={14} /> Habilidades
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">Habilidades liberadas</h3>
                      <p className="mt-2 text-sm text-[#dcc0aa]">Voce conquistou sua primeira habilidade. Abra o perfil para ver e usar todas as habilidades disponiveis.</p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => {
                              setShowSkillsUnlockPrompt(false);
                              onAcknowledgeSkillsUnlock?.();
                              openProfileModal('skills');
                          }}
                          className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                      >
                          Ver habilidades
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showImpulseUnlockPromptLevel !== null && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="bg-[#6b3141] px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f6eadc]">
                          <Zap size={14} /> Impulso
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">
                          {showImpulseUnlockPromptLevel === 4 ? 'Impulso desbloqueado' : 'Nova barra de impulso'}
                      </h3>
                      <p className="mt-2 text-sm text-[#dcc0aa]">
                          {showImpulseUnlockPromptLevel === 4
                              ? 'Agora voce pode carregar impulso e absorver para fortalecer suas acoes em batalha. A primeira barra de impulso foi liberada.'
                              : 'Seu poder cresceu. Uma nova barra de impulso foi desbloqueada para ampliar seu potencial nas batalhas.'}
                      </p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => {
                              setShowImpulseUnlockPromptLevel(null);
                              onAcknowledgeImpulseUnlock?.();
                          }}
                          className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                      >
                          Entendi
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showConstellationUnlockPrompt && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="bg-[#6b3141] px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f6eadc]">
                          <Orbit size={14} /> Constelacao
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">Constelacao habilitada</h3>
                      <p className="mt-2 text-sm text-[#dcc0aa]">Ao subir de nivel voce ganha pontos de evolucao. Agora voce pode abrir a aba de constelacao no perfil.</p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => {
                              setShowConstellationUnlockPrompt(false);
                              onAcknowledgeConstellationUnlock?.();
                              openProfileModal('constellation');
                          }}
                          className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                      >
                          Ver constelacao
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showItemsUnlockPrompt && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="bg-[#6b3141] px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f6eadc]">
                          <FlaskConical size={14} /> Itens
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">Itens liberados</h3>
                      <p className="mt-2 text-sm text-[#dcc0aa]">Agora voce pode usar itens comprados no mercador e itens conquistados dos inimigos durante a batalha.</p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => {
                              setShowItemsUnlockPrompt(false);
                              onAcknowledgeItemsUnlock?.();
                          }}
                          className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                      >
                          Entendi
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showFleeUnlockPrompt && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.22)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="bg-[#6b3141] px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f6eadc]">
                          <LogOut size={14} /> Fuga
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">Fuga liberada</h3>
                      <p className="mt-2 text-sm text-[#dcc0aa]">Agora voce pode fugir da caca e voltar ao acampamento a qualquer momento, com custo de 50 de ouro.</p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => {
                              setShowFleeUnlockPrompt(false);
                              onAcknowledgeFleeUnlock?.();
                          }}
                          className="w-full rounded-xl bg-[#4d7a96] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(77,122,150,0.28)] transition-all hover:bg-[#5a8aa6]"
                      >
                          Entendi
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showDiamondUnlockPrompt && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-[#95bdd0] bg-[#eef8fe] shadow-[0_24px_80px_rgba(34,116,152,0.26)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="bg-[linear-gradient(135deg,#2b6878,#66b8d2)] px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f2fbff]">
                          <GameAssetIcon name="diamond" size={14} /> Diamante
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">Primeiro diamante</h3>
                      <p className="mt-2 text-sm text-[#e4f6ff]">Voce encontrou seu primeiro diamante. Agora pode acumular diamantes para trocar por itens e cartas especiais.</p>
                  </div>
                  <div className="p-4">
                      <button
                          onClick={() => {
                              setShowDiamondUnlockPrompt(false);
                              onAcknowledgeDiamondUnlock?.();
                          }}
                          className="w-full rounded-xl bg-[#2b6878] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(34,116,152,0.28)] transition-all hover:bg-[#357b8e]"
                      >
                          Entendi
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ═══ TOP: Player vitals (left) + Stage (center) + Enemy HP (right) ═══ */}
      <div className="absolute top-0 left-0 w-full z-20 pointer-events-none pt-1.5 sm:pt-2.5 px-2 sm:px-4">
          <div className="sm:hidden space-y-2">
              <div className={`grid gap-2 ${showDiamondOnBattleHud ? 'grid-cols-[1.6fr_0.85fr_0.85fr_0.85fr]' : 'grid-cols-[1.6fr_0.85fr_0.85fr]'}`}>
                  <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-2.5 py-1.5 rounded-[12px] shadow-xl animate-fade-in-down">
                      <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b3141]">{isDungeonRun ? `FASE ${dungeonPhase}` : `FASE ${stage}`}</span>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <div className="h-2 flex-1 bg-[#e9d7c2] rounded-full overflow-hidden border border-[#dcc0aa]">
                                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#7d3d4d,#c89a66)] transition-all duration-500" style={{ width: `${isDungeonRun ? Math.min(100, (dungeonCleared / dungeonTotal) * 100) : Math.min(100, (killCount / 10) * 100)}%` }} />
                              </div>
                              <span className="shrink-0 text-[11px] font-black text-[#6b3141]">
                                  {isDungeonRun ? (dungeonCleared >= dungeonTotal ? <span className="text-rose-500 animate-pulse">BOSS</span> : `${dungeonCleared}/${dungeonTotal}`) : (killCount >= 10 ? <span className="text-rose-500 animate-pulse">BOSS</span> : `${killCount}/10`)}
                              </span>
                          </div>
                      </div>
                  </div>
                  {gameTime && !isDungeonRun ? (
                      <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-2.5 py-1.5 rounded-[12px] shadow-xl animate-fade-in-down">
                          <div className="flex h-full items-center justify-center gap-2">
                              <Clock size={14} className="text-[#6b3141]" />
                              <span className="text-[12px] font-black uppercase tracking-[0.12em] text-[#6b3141]">{gameTime}</span>
                          </div>
                      </div>
                  ) : (
                      <div className="rounded-[14px] border border-[#cfab91] bg-[#f7ecdd]/70" />
                  )}

                  <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-2.5 py-1.5 rounded-[12px] shadow-xl animate-fade-in-down">
                      <div className="flex items-center justify-center gap-2">
                          <GameAssetIcon name="coin" size={20} />
                          <span className="text-sm font-black text-[#8d5e29]">{player.gold}</span>
                      </div>
                  </div>

                  {showDiamondOnBattleHud && (
                      <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-2.5 py-1.5 rounded-[12px] shadow-xl animate-fade-in-down">
                          <div className="flex items-center justify-center gap-2">
                              <GameAssetIcon name="diamond" size={20} />
                              <span className="text-sm font-black text-[#346c7f]">{player.diamonds}</span>
                          </div>
                      </div>
                  )}
              </div>

              <div className={`grid items-start gap-2 ${enemy ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="flex min-w-0 flex-col items-stretch gap-1.5">
                      <div
                          className="pointer-events-auto w-full cursor-pointer overflow-hidden rounded-[18px] border border-[#cfab91] bg-[#f7ecdd]/94 px-3 py-2.5 shadow-xl backdrop-blur-md animate-fade-in-down transition-transform hover:-translate-y-[1px] active:scale-[0.995]"
                          role="button"
                          tabIndex={0}
                          onClick={openHeroStatusFromCard}
                          onKeyDown={handleHeroCardKeyDown}
                          title="Abrir status do heroi"
                      >
                          <div className="space-y-2">
                              <div
                                  className="-mx-3 -mt-2.5 mb-1.5 flex items-center justify-between gap-2 px-3 py-2"
                                  style={{
                                      background: `linear-gradient(135deg, ${classHeaderDarkColor} 0%, ${classHeaderColor} 100%)`,
                                      boxShadow: `0 6px 14px ${classHeaderDarkColor}44`,
                                  }}
                              >
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                                      <HeroClassIcon size={11} />
                                      {playerClassNamePt}
                                  </span>
                                  <span
                                      className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]"
                                      style={{
                                          color: classHeaderDarkColor,
                                          boxShadow: `0 4px 10px ${classHeaderDarkColor}33`,
                                      }}
                                  >
                                      Nv {player.level}
                                  </span>
                              </div>
                              <div>
                                  <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a4151]">HP</span>
                                      <span className="text-[12px] font-black text-[#6b3141]">{player.stats.hp}/{player.stats.maxHp}</span>
                                  </div>
                                  <div className="h-3 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#8d2f46,#d17482)] transition-all duration-300" style={{width: `${(player.stats.hp/player.stats.maxHp)*100}%`}}></div></div>
                              </div>
                              <div>
                                  <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#346c7f]">Mana</span>
                                      <span className="text-[12px] font-black text-[#6b3141]">{player.stats.mp}/{player.stats.maxMp}</span>
                                  </div>
                                  <div className="h-2.5 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#2b6878,#66b8d2)] transition-all duration-300" style={{width: `${(player.stats.mp/player.stats.maxMp)*100}%`}}></div></div>
                              </div>
                              {player.classResource.max > 0 && (
                                  <div className={`relative rounded-md px-1.5 py-1 transition-all duration-300 ${resourcePulse === 'gain' ? 'bg-emerald-200/35 ring-1 ring-emerald-500/35' : resourcePulse === 'spend' ? 'bg-rose-200/35 ring-1 ring-rose-500/35' : ''}`}>
                                      <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7c4c76]">{player.classResource.name}</span>
                                          <span className="text-[11px] font-black text-[#6b3141]">{player.classResource.value}/{player.classResource.max}</span>
                                      </div>
                                      <div className="h-2 bg-[#e9d7c2] rounded-full overflow-hidden">
                                          <div
                                              className={`h-full rounded-full transition-all duration-300 ${resourcePulse ? 'animate-pulse' : ''}`}
                                              style={{
                                                  width: `${player.classResource.max > 0 ? (player.classResource.value / player.classResource.max) * 100 : 0}%`,
                                                  background: `linear-gradient(90deg, ${player.classResource.color}, #f5e6ff)`,
                                              }}
                                          />
                                      </div>
                                  </div>
                              )}
                              <div className="pt-1 border-t border-[#dcc0aa]">
                                  <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a7068]">XP</span>
                                      <div className="flex-1 h-1.5 bg-[#e9d7c2] rounded-full overflow-hidden">
                                          <div className="h-full rounded-full bg-[linear-gradient(90deg,#7d3d4d,#c89a66)] transition-all duration-500" style={{width: `${(player.xp/player.xpToNext)*100}%`}}></div>
                                      </div>
                                      <span className="text-[9px] font-black text-[#6b3141]">{player.xp}/{player.xpToNext}</span>
                                  </div>
                              </div>
                              {heroBuffEntries.length > 0 && (
                                  <div className="pt-1 border-t border-[#dcc0aa]">
                                      <div className="flex flex-wrap gap-1.5">
                                          {heroBuffEntries.map((buff) => (
                                              <div key={buff.key} className={`inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] font-black leading-none shadow-sm ${buff.chipClass}`}>
                                                  {buff.icon}
                                                  <span>{buff.label}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="pointer-events-auto self-start flex flex-col gap-1">
                          <button
                              onClick={openBattleSettingsModal}
                              className="group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-16 sm:w-16"
                              title="Configuracoes"
                              aria-label="Configuracoes"
                          >
                              <span
                                  className="inline-flex"
                                  style={{
                                      filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
                                  }}
                              >
                                  <GameAssetIcon name="gear" size={34} />
                              </span>
                              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-full border border-[#cfab91] bg-[#f7ecdd]/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141] opacity-0 translate-x-1 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                                  Configuracao
                              </span>
                          </button>

                          <button
                              onClick={() => openProfileModal(undefined)}
                              className="group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-16 sm:w-16"
                              title="Perfil"
                              aria-label="Perfil"
                          >
                              <span
                                  className="inline-flex"
                                  style={{
                                      filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
                                  }}
                              >
                                  <GameAssetIcon name="book" size={34} />
                              </span>
                          </button>

                          {(!restrictProfileToStatusOnly || inventoryUnlocked) && (
                              <button
                                  onClick={() => openInventoryModal('all')}
                                  className="group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-16 sm:w-16"
                                  title="Mochila"
                                  aria-label="Mochila"
                              >
                                  <span
                                      className="inline-flex"
                                      style={{
                                          filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
                                      }}
                                  >
                                      <GameAssetIcon name="bag" size={34} />
                                  </span>
                              </button>
                          )}

                          {hasConstellationUnlocked && (
                              <button
                                  onClick={() => openProfileModal('constellation')}
                                  className="group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-16 sm:w-16"
                                  title="Constelacao"
                                  aria-label="Constelacao"
                              >
                                  <span
                                      className="inline-flex text-white"
                                      style={{
                                          filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
                                      }}
                                  >
                                      <Orbit size={32} />
                                  </span>
                                  {player.talentPoints > 0 && (
                                      <span
                                          className="absolute -top-1.5 -right-1.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-black text-white"
                                          style={{ backgroundColor: classAccentColor, boxShadow: `0 4px 10px ${classAccentColor}66, 0 0 0 1px rgba(255,255,255,0.6)` }}
                                      >
                                          {player.talentPoints}
                                      </span>
                                  )}
                              </button>
                          )}

                          {fleeUnlocked && !isDungeonRun && !enemy?.isBoss && killCount < 10 && (
                              <button
                                  onClick={() => setShowFleeConfirm(true)}
                                  disabled={!isPlayerTurn}
                                  className={`group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-16 sm:w-16 ${!isPlayerTurn ? 'cursor-not-allowed opacity-60' : ''}`}
                                  title="Fugir"
                                  aria-label="Fugir"
                              >
                                  <span
                                      className="inline-flex text-rose-600"
                                      style={{
                                          filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(190,24,93,0.35))',
                                      }}
                                  >
                                      <LogOut size={31} />
                                  </span>
                              </button>
                          )}
                      </div>
                  </div>

                  {enemy && (
                      <div className="flex flex-col gap-2">
                      <div className={`overflow-hidden rounded-[18px] border px-3 py-2.5 backdrop-blur-md animate-fade-in-down ${enemyCardToneClass}`}>
                          <div className="mb-1.5">
                              <div
                                  className="-mx-3 -mt-2.5 mb-1.5 flex items-center justify-between gap-2 px-3 py-2"
                                  style={{
                                      background: 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)',
                                      boxShadow: '0 6px 14px rgba(190,24,93,0.35)',
                                  }}
                              >
                                  <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.12em] text-white">{enemy.name}</span>
                                  <span className="inline-flex items-center gap-1">
                                      <span
                                          className="inline-flex items-center justify-center rounded-full border border-white/75 bg-white px-1.5 py-0.5 text-[#9f1239]"
                                          style={{ boxShadow: '0 4px 10px rgba(190,24,93,0.3)' }}
                                      >
                                          <EnemyClassIcon size={11} />
                                      </span>
                                      <span
                                          className="inline-flex items-center gap-1 rounded-full border border-white/75 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]"
                                          style={{
                                              color: '#9f1239',
                                              boxShadow: '0 4px 10px rgba(190,24,93,0.3)',
                                          }}
                                      >
                                          Nv {enemy.level}
                                      </span>
                                  </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                  {enemy.isBoss && (
                                      <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase text-rose-600">Chefão</span>
                                  )}
                                  {!enemy.isBoss && enemy.isSubBoss && (
                                      <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">Subchefe</span>
                                  )}
                              </div>
                          </div>
                          <div>
                              <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a4151]">HP</span>
                                  <span className="text-[12px] font-black text-[#6b3141]">{enemy.stats.hp}/{enemy.stats.maxHp}</span>
                              </div>
                              <div className="h-3 bg-[#e9d7c2] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#8d2f46,#d17482)] transition-all duration-300" style={{width: `${Math.max(0, (enemy.stats.hp/enemy.stats.maxHp)*100)}%`}}></div>
                              </div>
                          </div>
                          {enemyUsesManaSkills && (
                              <div>
                                  <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#346c7f]">Mana</span>
                                      <span className="text-[12px] font-black text-[#6b3141]">{enemy.stats.mp}/{enemy.stats.maxMp}</span>
                                  </div>
                                  <div className="h-2.5 bg-[#e9d7c2] rounded-full overflow-hidden">
                                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#2b6878,#66b8d2)] transition-all duration-300" style={{width: `${Math.max(0, (enemy.stats.mp/enemy.stats.maxMp)*100)}%`}}></div>
                                  </div>
                              </div>
                          )}
                          {enemy.combatBuffs.turns > 0 && (
                              <div className="pt-1 border-t border-[#dcc0aa]">
                                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-700">
                                      Impulso inicial ({enemy.combatBuffs.turns}t)
                                  </span>
                              </div>
                          )}
                          {(enemy.statusEffects?.length ?? 0) > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                  {enemy.statusEffects?.slice(0, 3).map((status) => {
                                      const fromHeroSkill = status.source === 'skill';
                                      return (
                                          <span
                                              key={status.id}
                                              className="rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em]"
                                              style={fromHeroSkill
                                                  ? { borderColor: `${classAccentColor}88`, backgroundColor: `${classAccentColor}20`, color: classAccentColor }
                                                  : { borderColor: `${status.color}55`, backgroundColor: `${status.color}18`, color: status.color }}
                                          >
                                              {status.name} {status.duration}t
                                          </span>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                      {!isDungeonRun && killCount >= 10 && !enemy.isBoss && (
                          <button
                              onClick={() => onStartBattle(true)}
                              className="pointer-events-auto w-full rounded-[14px] border border-rose-300 bg-[linear-gradient(135deg,#e11d48_0%,#f43f5e_100%)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_24px_rgba(225,29,72,0.36)] transition-all active:scale-[0.98] animate-pulse flex items-center justify-center gap-2"
                          >
                              <Skull size={16} /> ENFRENTAR CHEFÃO
                          </button>
                      )}
                      </div>
                  )}
              </div>
          </div>

          <div className="hidden sm:flex items-start justify-between gap-1.5 sm:gap-3">
              {/* Player vitals — left */}
              <div className="flex flex-1 max-w-[48%] sm:max-w-[280px] flex-col items-start gap-1.5">
                  <div
                      className="pointer-events-auto cursor-pointer overflow-hidden rounded-[16px] border border-[#cfab91] bg-[#f7ecdd]/94 px-2.5 py-2 shadow-xl backdrop-blur-md w-full animate-fade-in-down transition-transform hover:-translate-y-[1px] active:scale-[0.995]"
                      role="button"
                      tabIndex={0}
                      onClick={openHeroStatusFromCard}
                      onKeyDown={handleHeroCardKeyDown}
                      title="Abrir status do heroi"
                  >
                      <div className="space-y-1.5">
                          <div
                              className="-mx-2.5 -mt-2 mb-1.5 flex items-center justify-between gap-2 px-2.5 py-1.5"
                              style={{
                                  background: `linear-gradient(135deg, ${classHeaderDarkColor} 0%, ${classHeaderColor} 100%)`,
                                  boxShadow: `0 6px 14px ${classHeaderDarkColor}44`,
                              }}
                          >
                              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-white">
                                  <HeroClassIcon size={12} />
                                  {playerClassNamePt}
                              </span>
                              <span
                                  className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]"
                                  style={{
                                      color: classHeaderDarkColor,
                                      boxShadow: `0 4px 10px ${classHeaderDarkColor}33`,
                                  }}
                              >
                                  Nv {player.level}
                              </span>
                          </div>
                          <div>
                              <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9a4151]">HP</span>
                                  <span className="text-sm font-black text-[#6b3141]">{player.stats.hp}/{player.stats.maxHp}</span>
                              </div>
                              <div className="h-2.5 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#8d2f46,#d17482)] transition-all duration-300" style={{width: `${(player.stats.hp/player.stats.maxHp)*100}%`}}></div></div>
                          </div>
                          <div>
                              <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#346c7f]">Mana</span>
                                  <span className="text-sm font-black text-[#6b3141]">{player.stats.mp}/{player.stats.maxMp}</span>
                              </div>
                              <div className="h-2 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#2b6878,#66b8d2)] transition-all duration-300" style={{width: `${(player.stats.mp/player.stats.maxMp)*100}%`}}></div></div>
                          </div>
                          {player.classResource.max > 0 && (
                              <div className={`relative rounded-md px-1 py-0.5 transition-all duration-300 ${resourcePulse === 'gain' ? 'bg-emerald-200/35 ring-1 ring-emerald-500/35' : resourcePulse === 'spend' ? 'bg-rose-200/35 ring-1 ring-rose-500/35' : ''}`}>
                                  <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7c4c76]">{player.classResource.name}</span>
                                      <span className="text-sm font-black text-[#6b3141]">{player.classResource.value}/{player.classResource.max}</span>
                                  </div>
                                  <div className="h-1.5 bg-[#e9d7c2] rounded-full overflow-hidden">
                                      <div
                                          className={`h-full rounded-full transition-all duration-300 ${resourcePulse ? 'animate-pulse' : ''}`}
                                          style={{
                                              width: `${player.classResource.max > 0 ? (player.classResource.value / player.classResource.max) * 100 : 0}%`,
                                              background: `linear-gradient(90deg, ${player.classResource.color}, #f5e6ff)`,
                                          }}
                                      />
                                  </div>
                                  {resourceDelta !== 0 && (
                                      <div className={`pointer-events-none absolute -right-1 -top-2 rounded-full border px-1.5 py-0.5 text-[8px] font-black ${resourceDelta > 0 ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-700' : 'border-rose-500/40 bg-rose-500/20 text-rose-700'}`}>
                                          {resourceDelta > 0 ? `+${resourceDelta}` : resourceDelta}
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                      {/* XP compact */}
                      <div className="mt-1.5 pt-1 border-t border-[#dcc0aa]">
                          <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#9a7068]">XP</span>
                              <div className="flex-1 h-2 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#7d3d4d,#c89a66)] transition-all duration-500" style={{width: `${(player.xp/player.xpToNext)*100}%`}}></div></div>
                              <span className="text-sm font-black text-[#6b3141]">{player.xp}/{player.xpToNext}</span>
                          </div>
                      </div>
                      {/* Buffs */}
                      {heroBuffEntries.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-[66px] overflow-hidden">
                              {heroBuffEntries.map((buff) => (
                                  <div key={buff.key} className={`inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] font-black leading-none shadow-sm ${buff.chipClass}`}>
                                      {buff.icon}
                                      <span>{buff.label}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="pointer-events-auto flex flex-col gap-1 sm:gap-1">
                      <button
                          onClick={openBattleSettingsModal}
                          className="group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-11 sm:w-11"
                          title="Configuracoes"
                          aria-label="Configuracoes"
                      >
                          <span
                              className="inline-flex items-center justify-center rounded-full border border-[#f6eadc] bg-[#6b3141]/90 p-1"
                              style={{
                                  filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
                              }}
                          >
                              <GameAssetIcon name="gear" size={22} />
                          </span>
                          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-full border border-[#cfab91] bg-[#f7ecdd]/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141] opacity-0 translate-x-1 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                              Configuracao
                          </span>
                      </button>

                      <button
                          onClick={() => openProfileModal(undefined)}
                          className="group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-11 sm:w-11"
                          title="Perfil"
                          aria-label="Perfil"
                      >
                          <span
                              className="inline-flex"
                              style={{
                                  filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
                              }}
                          >
                              <GameAssetIcon name="book" size={34} />
                          </span>
                          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-full border border-[#cfab91] bg-[#f7ecdd]/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141] opacity-0 translate-x-1 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                              Perfil
                          </span>
                      </button>

                      {(!restrictProfileToStatusOnly || inventoryUnlocked) && (
                          <button
                              onClick={() => openInventoryModal('all')}
                              className="group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-11 sm:w-11"
                              title="Mochila"
                              aria-label="Mochila"
                          >
                              <span
                                  className="inline-flex"
                                  style={{
                                      filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
                                  }}
                              >
                                  <GameAssetIcon name="bag" size={34} />
                              </span>
                              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-full border border-[#cfab91] bg-[#f7ecdd]/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141] opacity-0 translate-x-1 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                                  Mochila
                              </span>
                          </button>
                      )}

                      {hasConstellationUnlocked && (
                          <button
                              onClick={() => openProfileModal('constellation')}
                              className="group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-11 sm:w-11"
                              title="Constelacao"
                              aria-label="Constelacao"
                          >
                              <span
                                  className="inline-flex text-white"
                                  style={{
                                      filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
                                  }}
                              >
                                  <Orbit size={32} />
                              </span>
                              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-full border border-[#cfab91] bg-[#f7ecdd]/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141] opacity-0 translate-x-1 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                                  Constelacao
                              </span>
                              {player.talentPoints > 0 && (
                                  <span
                                      className="absolute -top-1.5 -right-1.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-black text-white"
                                      style={{ backgroundColor: classAccentColor, boxShadow: `0 4px 10px ${classAccentColor}66, 0 0 0 1px rgba(255,255,255,0.6)` }}
                                  >
                                      {player.talentPoints}
                                  </span>
                              )}
                          </button>
                      )}

                      {fleeUnlocked && !isDungeonRun && !enemy?.isBoss && killCount < 10 && (
                          <button
                              onClick={() => setShowFleeConfirm(true)}
                              disabled={!isPlayerTurn}
                              className={`group relative flex h-14 w-14 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:h-11 sm:w-11 ${!isPlayerTurn ? 'cursor-not-allowed opacity-60' : ''}`}
                              title="Fugir"
                              aria-label="Fugir"
                          >
                              <span
                                  className="inline-flex text-rose-600"
                                  style={{
                                      filter: 'drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 4px 10px rgba(190,24,93,0.35))',
                                  }}
                              >
                                  <LogOut size={32} />
                              </span>
                              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-full border border-rose-400 bg-rose-100/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-rose-700 opacity-0 translate-x-1 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                                  Fugir
                              </span>
                          </button>
                      )}
                  </div>
              </div>

              {/* Stage progress — center pill */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 self-start mt-0.5">
                  <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-2 sm:px-3 py-1 rounded-[12px] shadow-xl animate-fade-in-down">
                      <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6b3141]">{isDungeonRun ? `FASE ${dungeonPhase}` : `FASE ${stage}`}</span>
                          <div className="flex items-center gap-1.5">
                              <div className="w-14 sm:w-20 h-2 bg-[#e9d7c2] rounded-full overflow-hidden border border-[#dcc0aa]">
                                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#7d3d4d,#c89a66)] transition-all duration-500" style={{ width: `${isDungeonRun ? Math.min(100, (dungeonCleared / dungeonTotal) * 100) : Math.min(100, (killCount / 10) * 100)}%` }} />
                              </div>
                              <span className="text-[11px] font-black text-[#6b3141]">
                                  {isDungeonRun ? (dungeonCleared >= dungeonTotal ? <span className="text-rose-500 animate-pulse">BOSS</span> : `${dungeonCleared}/${dungeonTotal}`) : (killCount >= 10 ? <span className="text-rose-500 animate-pulse">BOSS</span> : `${killCount}/10`)}
                              </span>
                          </div>
                      </div>
                  </div>
                  {/* Clock card — same style */}
                  {gameTime && !isDungeonRun && (
                      <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-3 sm:px-4 py-1.5 rounded-[12px] shadow-xl animate-fade-in-down">
                          <div className="flex items-center gap-2">
                              <Clock size={16} className="text-[#6b3141]" />
                              <span className="text-xs sm:text-sm font-black uppercase tracking-[0.14em] text-[#6b3141]">{gameTime}</span>
                          </div>
                      </div>
                  )}
                  <div className={`grid gap-2 w-full min-w-[170px] ${showDiamondOnBattleHud ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-3 py-1.5 rounded-[12px] shadow-xl animate-fade-in-down">
                          <div className="flex items-center justify-center gap-2">
                              <GameAssetIcon name="coin" size={20} />
                              <span className="text-sm sm:text-base font-black text-[#8d5e29]">{player.gold}</span>
                          </div>
                      </div>
                      {showDiamondOnBattleHud && (
                          <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-3 py-1.5 rounded-[12px] shadow-xl animate-fade-in-down">
                              <div className="flex items-center justify-center gap-2">
                                  <GameAssetIcon name="diamond" size={20} />
                                  <span className="text-sm sm:text-base font-black text-[#346c7f]">{player.diamonds}</span>
                              </div>
                          </div>
                      )}
                  </div>
              </div>

              {/* Enemy HP — right */}
              {enemy && (
                  <div className="flex flex-1 max-w-[48%] flex-col items-end gap-1.5 sm:max-w-[250px]">
                      <div className={`w-full overflow-hidden rounded-[16px] border px-2.5 py-2 backdrop-blur-md animate-fade-in-down ${enemyCardToneClass}`}>
                          <div className="mb-1">
                          <div
                              className="-mx-2.5 -mt-2 mb-1.5 flex items-center justify-between gap-2 px-2.5 py-1.5"
                              style={{
                                  background: 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)',
                                  boxShadow: '0 6px 14px rgba(190,24,93,0.35)',
                              }}
                          >
                              <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.12em] text-white">{enemy.name}</span>
                              <span className="inline-flex items-center gap-1">
                                  <span
                                      className="inline-flex items-center justify-center rounded-full border border-white/75 bg-white px-1.5 py-0.5 text-[#9f1239]"
                                      style={{ boxShadow: '0 4px 10px rgba(190,24,93,0.3)' }}
                                  >
                                      <EnemyClassIcon size={11} />
                                  </span>
                                  <span
                                      className="inline-flex items-center gap-1 rounded-full border border-white/75 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]"
                                      style={{
                                          color: '#9f1239',
                                          boxShadow: '0 4px 10px rgba(190,24,93,0.3)',
                                      }}
                                  >
                                      Nv {enemy.level}
                                  </span>
                              </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                              {enemy.isBoss && (
                                  <span className="rounded-full border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-rose-600">Chefão</span>
                              )}
                              {!enemy.isBoss && enemy.isSubBoss && (
                                  <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-700">Subchefe</span>
                              )}
                          </div>
                      </div>
                      <div>
                          <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9a4151]">HP</span>
                              <span className="text-sm font-black text-[#6b3141]">{enemy.stats.hp}/{enemy.stats.maxHp}</span>
                          </div>
                          <div className="h-2.5 bg-[#e9d7c2] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[linear-gradient(90deg,#8d2f46,#d17482)] transition-all duration-300" style={{width: `${Math.max(0, (enemy.stats.hp/enemy.stats.maxHp)*100)}%`}}></div>
                          </div>
                      </div>
                      {enemyUsesManaSkills && (
                          <div className="mt-1">
                              <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#346c7f]">Mana</span>
                                  <span className="text-sm font-black text-[#6b3141]">{enemy.stats.mp}/{enemy.stats.maxMp}</span>
                              </div>
                              <div className="h-2 bg-[#e9d7c2] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#2b6878,#66b8d2)] transition-all duration-300" style={{width: `${Math.max(0, (enemy.stats.mp/enemy.stats.maxMp)*100)}%`}}></div>
                              </div>
                          </div>
                      )}
                      {enemy.combatBuffs.turns > 0 && (
                          <div className="mt-1">
                              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-700">
                                  Impulso ({enemy.combatBuffs.turns}t)
                              </span>
                          </div>
                      )}
                      {(enemy.statusEffects?.length ?? 0) > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                              {enemy.statusEffects?.slice(0, 3).map((status) => {
                                  const fromHeroSkill = status.source === 'skill';
                                  return (
                                      <span
                                          key={status.id}
                                          className="rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase"
                                          style={fromHeroSkill
                                              ? { borderColor: `${classAccentColor}88`, backgroundColor: `${classAccentColor}20`, color: classAccentColor }
                                              : { borderColor: `${status.color}55`, backgroundColor: `${status.color}18`, color: status.color }}
                                      >
                                          {status.name} {status.duration}t
                                      </span>
                                  );
                              })}
                          </div>
                      )}
                      </div>
                      {!isDungeonRun && killCount >= 10 && !enemy.isBoss && (
                          <button onClick={() => onStartBattle(true)} className="pointer-events-auto w-full rounded-[14px] border border-rose-300 bg-[linear-gradient(135deg,#e11d48_0%,#f43f5e_100%)] px-3 py-2 text-[10px] sm:text-sm font-black uppercase tracking-[0.12em] text-white transition-all hover:brightness-105 hover:scale-[1.01] animate-pulse shadow-[0_12px_24px_rgba(225,29,72,0.36)] flex items-center justify-center gap-2">
                              <Skull size={16} /> ENFRENTAR CHEFÃO
                          </button>
                      )}
                  </div>
              )}
          </div>
      </div>

      {/* ═══ BOTTOM: Hero name/profile (left) + Actions 2x2 (right) ═══ */}
      <div className="flex-1" /> {/* spacer to push bottom content down */}
      <div className="relative w-full pointer-events-auto mb-2 sm:mb-4 px-2 sm:px-4">
          <div className="flex items-end justify-between gap-2">
              {/* Left: hero identity + quick buttons */}
              <div className="flex flex-col gap-2 shrink-0">
                  {/* Special buttons — above the card */}
                  {isDungeonRun && dungeonRewards && (
                      <button onClick={() => setShowDungeonLootPreview(true)} className="self-start rounded-[10px] border border-[#cfab91] bg-[#f4e5d4] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
                          Espólio
                      </button>
                  )}
              </div>

              {/* Right: action grid */}
              <div ref={battleActionsRef} className="relative flex min-w-0 flex-1 flex-col items-end gap-2 sm:absolute sm:bottom-0 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:items-center">
                  {impulseUnlocked && (
                      <div className="grid w-full max-w-[360px] grid-cols-5 items-center gap-1 sm:flex sm:w-[360px] sm:justify-start sm:gap-2">
                      <div className="col-span-1 flex items-center justify-center gap-1.5 sm:w-[68px] sm:flex-none sm:justify-center sm:gap-2">
                          {Array.from({ length: impulseCapacity }, (_, slot) => {
                              const isFilled = player.impulso > slot;
                              const blockColor = impulseReserveColors[slot];
                              return (
                                  <span
                                      key={`impulse-slot-${slot}`}
                                      className="h-5 w-8 rounded-md border-2 transition-all sm:h-6 sm:w-10"
                                      style={isFilled
                                          ? {
                                              borderColor: '#ffffff',
                                              background: `linear-gradient(135deg, ${blockColor}, ${blockColor}cc)`,
                                              boxShadow: `0 0 14px ${blockColor}aa`,
                                            }
                                          : {
                                              borderColor: '#d2b6a2',
                                              backgroundColor: '#f9ecdf',
                                            }}
                                  />
                              );
                          })}
                      </div>
                      {player.impulso > 0 && (
                          <button
                              onClick={() => { setActiveBattleMenu(null); onAbsorbImpulse(); }}
                              disabled={!isPlayerTurn || player.impulsoAtivo >= impulseCapacity}
                              className={`relative col-span-2 overflow-hidden inline-flex h-7 items-center justify-center rounded-[8px] border-2 px-2 text-[9px] font-black uppercase tracking-[0.08em] transition-all sm:h-8 sm:px-2.5 sm:text-[10px] ${
                                  !isPlayerTurn || player.impulsoAtivo >= impulseCapacity
                                      ? 'cursor-not-allowed border-[#dcc0aa] bg-[#e9d7c2] text-[#8f6c67]'
                                      : 'border-[#f59e0b] bg-[#fff4de] text-[#6b3141] hover:bg-[#ffefcf] hover:shadow-[0_0_26px_rgba(245,158,11,0.55)]'
                              }`}
                              style={!isPlayerTurn || player.impulsoAtivo >= 3
                                  ? undefined
                                  : {
                                      boxShadow: `0 0 0 1px ${absorbGlowColor}88, 0 0 24px ${absorbGlowColor}aa`,
                                    }}
                          >
                              <span>Absorver</span>
                              {isPlayerTurn && player.impulsoAtivo < impulseCapacity && (
                                  <span className="pointer-events-none absolute inset-0 rounded-[10px]">
                                      <span className="absolute left-[16%] top-[28%] h-1.5 w-1.5 rounded-full animate-ping" style={{ backgroundColor: currentImpulseFxColor }} />
                                      <span className="absolute right-[18%] top-[35%] h-1 w-1 rounded-full animate-ping" style={{ backgroundColor: currentImpulseFxColor }} />
                                      <span className="absolute left-[56%] bottom-[22%] h-1 w-1 rounded-full animate-pulse" style={{ backgroundColor: currentImpulseFxColor }} />
                                  </span>
                              )}
                          </button>
                      )}
                  </div>
                  )}
                  <div className="grid w-full max-w-[360px] grid-cols-5 gap-1 sm:gap-1.5 sm:w-[360px]">
                      {impulseUnlocked && (
                          <ActionTile
                              icon={<Zap size={18} />}
                              label="IMPULSO"
                              onClick={() => { setActiveBattleMenu(null); onChargeImpulse(); }}
                              disabled={!isPlayerTurn || player.impulso >= impulseCapacity}
                              variant="skill"
                              forceStyle={{
                                  backgroundColor: classImpulseBaseColor,
                                  borderColor: classImpulseBorderColor,
                                  color: '#ffffff',
                              }}
                              glowColor={classImpulseBaseColor}
                              glowStrength={26}
                              energized={player.impulso > 0}
                              sparkleColor={currentImpulseFxColor}
                          />
                      )}
                      <ActionTile icon={usesMagicBasicAttack ? <Sparkles size={18} /> : (usesBowBasicAttack ? <Crosshair size={18} /> : <Sword size={18} />)} label={usesMagicBasicAttack ? 'MAGIA' : 'ATACAR'} onClick={() => { setActiveBattleMenu(null); onAttack(); }} disabled={!isPlayerTurn} variant="attack" glowColor={impulseButtonGlowColor} glowStrength={24} energized={buttonsEnergized} sparkleColor={currentImpulseFxColor} />
                      <ActionTile icon={<Shield size={18} />} label="DEFENDER" onClick={() => { setActiveBattleMenu(null); onDefend(); }} disabled={!isPlayerTurn} variant="defense" glowColor={impulseButtonGlowColor} glowStrength={24} energized={buttonsEnergized} sparkleColor={currentImpulseFxColor} />
                                            {showSkillsAction && (
                                                <div className="relative col-span-1">
                                                    {activeBattleMenu === 'skills' && (
                                                        <div className="absolute bottom-full right-[-68px] sm:right-0 z-40 mb-2 w-[min(84vw,340px)] rounded-2xl border border-[#b996cf] bg-[linear-gradient(140deg,rgba(245,236,252,0.98),rgba(238,225,247,0.97))] p-2.5 shadow-[0_16px_38px_rgba(88,48,111,0.32)] animate-fade-in-down">
                                                            <div className="mb-2 flex items-center justify-between px-1">
                                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#6f447f]">
                                                                    <Sparkles size={12} />
                                                                    Habilidades
                                                                </span>
                                                                <button onClick={() => setActiveBattleMenu(null)} className="flex h-6 w-6 items-center justify-center rounded-md border border-[#c6abd9] bg-white/60 text-[#6f447f] transition-colors hover:bg-white/90" aria-label="Fechar habilidades">
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                            {player.skills.length > 0 ? (
                                                                <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-0.5">
                                                                    {player.skills.map(skill => {
                                                                        const requiredResource = skill.resourceEffect?.cost ?? 0;
                                                                        const hasResource = player.classResource.value >= requiredResource;
                                                                        const effectiveManaCost = player.impulsoAtivo >= 1 ? Math.max(1, Math.floor(skill.manaCost * 0.7)) : skill.manaCost;
                                                                        const canCast = player.stats.mp >= effectiveManaCost && hasResource;
                                                                        const skillTone = skill.trailColor ?? '#a855f7';
                                                                        return (
                                                                            <button
                                                                                key={skill.id}
                                                                                onClick={() => { onSkill(skill); setActiveBattleMenu(null); }}
                                                                                disabled={!isPlayerTurn || !canCast}
                                                                                className={`w-full rounded-xl border px-2.5 py-2 text-left transition-all ${!isPlayerTurn || !canCast ? 'bg-[#ebe2d8] border-[#d5c0ac] text-[#8f6c67] cursor-not-allowed' : 'text-[#4d2d5d] hover:-translate-y-0.5 hover:shadow-md'}`}
                                                                                style={!isPlayerTurn || !canCast ? undefined : { background: `linear-gradient(135deg, ${skillTone}38 0%, ${skillTone}1f 45%, #fff7ed 100%)`, borderColor: `${skillTone}aa` }}
                                                                            >
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <div className="flex min-w-0 items-start gap-2">
                                                                                        <div
                                                                                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                                                                                            style={!isPlayerTurn || !canCast ? undefined : { borderColor: `${skillTone}99`, backgroundColor: `${skillTone}24`, color: skillTone }}
                                                                                        >
                                                                                            <Sparkles size={14} />
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <div className="truncate text-[11px] sm:text-xs font-black uppercase tracking-[0.1em]">{skill.name}</div>
                                                                                            <div className="mt-0.5 text-[10px] text-[#6e5367] leading-relaxed">{describeBattleSkill(skill)}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="shrink-0 space-y-1 text-right">
                                                                                        <div className="rounded-md border border-[#6aa9d4] bg-[#dff2ff] px-1.5 py-0.5 text-[10px] font-black text-[#1d5f86]">
                                                                                            {effectiveManaCost} MP
                                                                                        </div>
                                                                                        {requiredResource > 0 && (
                                                                                            <div
                                                                                                className={`rounded-md border px-1.5 py-0.5 text-[8px] font-black ${hasResource ? '' : 'border-rose-300 bg-rose-100 text-rose-700'}`}
                                                                                                style={hasResource ? {
                                                                                                    borderColor: `${player.classResource.color}66`,
                                                                                                    backgroundColor: '#ffffff',
                                                                                                    color: player.classResource.color,
                                                                                                } : undefined}
                                                                                            >
                                                                                                {requiredResource} {skill.resourceLabel || player.classResource.name}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="rounded-xl border border-dashed border-[#c7adcf] bg-white/55 px-3 py-4 text-center text-[11px] font-semibold text-[#7e6277]">
                                                                    Nenhuma habilidade disponivel.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <ActionTile icon={<Sparkles size={18} />} label="HABILIDADES" onClick={() => setActiveBattleMenu(prev => prev === 'skills' ? null : 'skills')} disabled={!isPlayerTurn || player.skills.length === 0} variant="skill" glowColor={impulseButtonGlowColor} glowStrength={24} energized={buttonsEnergized} sparkleColor={currentImpulseFxColor} />
                                                </div>
                                            )}
                                            {showItemsAction && (
                                                <div className="relative col-span-1">
                                                    {activeBattleMenu === 'items' && (
                                                        <div className="absolute bottom-full right-0 z-40 mb-2 w-[min(84vw,340px)] rounded-2xl border border-[#d8b792] bg-[linear-gradient(140deg,rgba(255,245,230,0.98),rgba(254,235,196,0.96))] p-2.5 shadow-[0_16px_38px_rgba(154,101,48,0.3)] animate-fade-in-down">
                                                            <div className="mb-2 flex items-center justify-between px-1">
                                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#925c27]">
                                                                    <FlaskConical size={12} />
                                                                    Itens
                                                                </span>
                                                                <button onClick={() => setActiveBattleMenu(null)} className="flex h-6 w-6 items-center justify-center rounded-md border border-[#d6b189] bg-white/60 text-[#925c27] transition-colors hover:bg-white/90" aria-label="Fechar itens">
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                            {usableItems.length > 0 ? (
                                                                <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-0.5">
                                                                    {usableItems.map(item => (
                                                                        <button
                                                                            key={item.id}
                                                                            onClick={() => {
                                                                                if (item.id === 'pot_dg_recall') {
                                                                                    setPendingDungeonExtractItem(item);
                                                                                    setShowDungeonExtractConfirm(true);
                                                                                    setActiveBattleMenu(null);
                                                                                    return;
                                                                                }
                                                                                onUseItem(item.id);
                                                                                setActiveBattleMenu(null);
                                                                            }}
                                                                            disabled={!isPlayerTurn}
                                                                            className={`w-full rounded-xl border px-2.5 py-2 text-left transition-all ${!isPlayerTurn ? 'bg-[#ebe2d8] border-[#d5c0ac] text-[#8f6c67] cursor-not-allowed' : 'border-amber-300 bg-[#fff4de] text-[#6b3141] hover:-translate-y-0.5 hover:bg-[#ffefcf]'}`}
                                                                        >
                                                                            <div className="flex items-start justify-between gap-2">
                                                                                <div className="min-w-0">
                                                                                    <div className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs font-black uppercase tracking-[0.1em]">
                                                                                        <span>{item.icon}</span>
                                                                                        <span className="truncate">{item.name}</span>
                                                                                    </div>
                                                                                    <div className="mt-0.5 text-[10px] text-[#805f4f] leading-relaxed">{describeBattleItem(item)}</div>
                                                                                </div>
                                                                                <div className="shrink-0 rounded-md border border-amber-500/40 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                                                                                    x{player.inventory[item.id]}
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="rounded-xl border border-dashed border-[#d6b189] bg-white/55 px-3 py-4 text-center text-[11px] font-semibold text-[#8f6c67]">
                                                                    Nenhum item de batalha disponivel.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <ActionTile icon={<FlaskConical size={18} />} label="ITENS" onClick={() => setActiveBattleMenu(prev => prev === 'items' ? null : 'items')} disabled={!isPlayerTurn || usableItems.length === 0} variant="item" />
                                                </div>
                                            )}
                  </div>
              </div>
          </div>
      </div>

        <AnimatedModal open={showProfile}>
          {(isClosing) => (
                        <CharacterSheetModal player={player} shopItems={shopItems} onClose={closeProfileModal} onOpenInventory={(initialFilter) => { closeProfileModal(); openInventoryModal(initialFilter ?? 'all', true); }} onUnlockTalent={onUnlockTalent} onResetTalents={onResetTalents} respecUnlockPromptActive={constellationRespecUnlockPromptActive} onAcknowledgeRespecUnlock={onAcknowledgeConstellationRespecUnlock} isClosing={isClosing} restrictToStatusOnly={restrictProfileToStatusOnly} allowInventory={inventoryUnlocked} allowCardsTab={allowCardsInProfile} allowSkillsTab={showSkillsAction} allowConstellationTab={hasConstellationUnlocked} initialTab={profileInitialTab} />
          )}
        </AnimatedModal>
        <AnimatedModal open={showInventory}>
          {(isClosing) => (
            <InventoryModal player={player} shopItems={shopItems} onClose={closeInventoryModal} onEquip={onEquipItem} onUnequip={onUnequipItem} onUse={onUseItem} isBattleContext initialFilter={inventoryInitialFilter} isClosing={isClosing} />
          )}
        </AnimatedModal>
    </div>
  );
};
