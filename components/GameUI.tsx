
import React, { useState, useEffect } from 'react';
import { Player, Enemy, BattleLog, TurnState, Item, Skill, GameState, FloatingText, Rarity, ProgressionCard, CardRewardOffer, AlchemistCardOffer, AlchemistItemOffer, DungeonResult, DungeonRewards } from '../types';
import { Sword, Shield, Zap, Heart, Coins, ShoppingBag, Skull, Play, Plus, FlaskConical, User, X, Home, LogOut, DollarSign, AlertTriangle, MousePointerClick, Shirt, Footprints, Crown, LayoutGrid, Sparkles, Crosshair, ArrowLeft, Star } from 'lucide-react';
import { ItemPreviewThree } from './items/ItemPreviewThree';
import { GameAssetIcon } from './ui/game-asset-icon';
import { CharacterSheetModal } from './profile/CharacterSheetModal';
import { InventoryScreen as InventoryModal } from './profile/InventoryScreen';
import { ShopMenuScreen } from './shop/ShopMenuScreen';
import { ALL_ITEMS, SKILLS } from '../constants';
import { ALL_CARDS } from '../game/data/cards';
import { getPlayerClassById, PLAYER_CLASSES } from '../game/data/classes';

interface GameUIProps {
  player: Player;
  enemy: Enemy | null;
  gameState: GameState;
  turnState: TurnState;
  logs: BattleLog[];
  onAttack: () => void;
  onDefend: () => void;
  onSkill: (skill: Skill) => void;
  onUseItem: (itemId: string) => void;
  onStartBattle: (isBoss: boolean) => void;
  onEnterShop: () => void;
  onBuyItem: (item: Item) => void;
  onSellItem: (item: Item) => void;
  onEquipItem: (item: Item) => void;
  onContinue: () => void; // Used for Level Up or Victory -> Tavern
  onFlee: () => void;
  currentNarration: string;
  shopItems: Item[];
  floatingTexts?: FloatingText[];
  stage: number;
  killCount: number;
    isDungeonRun?: boolean;
    dungeonRewards?: DungeonRewards | null;
    dungeonCleared?: number;
    dungeonTotal?: number;
    gameTime?: string;
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

    const value = Number.isInteger(primaryEffect.value)
        ? primaryEffect.value.toString()
        : `${Math.round(primaryEffect.value * 100)}%`;

    switch (primaryEffect.type) {
        case 'gold_instant': return `+${value} ouro`;
        case 'xp_instant': return `+${value} XP`;
        case 'max_hp': return `+${value} vida máxima`;
        case 'max_mp': return `+${value} mana máxima`;
        case 'atk': return `+${value} ataque`;
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

const ActionTile = ({
    icon,
    label,
    disabled,
    onClick,
    variant,
}: {
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    onClick: () => void;
    variant: 'attack' | 'defense' | 'item' | 'neutral' | 'danger' | 'skill';
}) => {
    const variantClass = {
        attack: 'bg-[#c44b54] border-[#a83a42] text-white hover:bg-[#b5424a] shadow-lg shadow-[#c44b54]/20',
        defense: 'bg-[#4d7a96] border-[#3b6580] text-white hover:bg-[#5a8aa6] shadow-lg shadow-[#4d7a96]/20',
        item: 'bg-[#b87a3a] border-[#9a6530] text-white hover:bg-[#c88a4a]',
        neutral: 'bg-[#f4e5d4] border-[#cfab91] text-[#6b3141] hover:bg-[#e9d7c2]',
        danger: 'bg-rose-500 border-rose-600 text-white hover:brightness-110',
        skill: 'bg-[#7c4c76] border-[#664060] text-white hover:bg-[#8d5d87] shadow-lg shadow-[#7c4c76]/20',
    }[variant];

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`col-span-1 rounded-[14px] aspect-square flex flex-col items-center justify-center gap-0.5 border-b-2 sm:border-b-3 transition-all active:translate-y-0.5 active:border-b-0 ${disabled ? 'bg-[#e9d7c2] border-[#dcc0aa] text-[#8f6c67] cursor-not-allowed' : variantClass}`}
        >
            {icon}
            <span className="font-black text-[7px] sm:text-[10px] tracking-wide uppercase">{label}</span>
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
            `}</style>
            <div className={`rounded-2xl border-2 shadow-2xl p-4 sm:p-6 text-white text-center max-w-[260px] sm:max-w-xs w-full mx-3 backdrop-blur-md
                ${loot.isBoss
                    ? 'bg-slate-950/95 border-amber-500 shadow-amber-900/40'
                    : 'bg-slate-950/95 border-slate-600 shadow-black/60'
                }
            `}>
                <div className="mb-2 sm:mb-3">
                    <div className="text-2xl sm:text-4xl mb-1">{loot.isBoss ? '💀' : '☠️'}</div>
                    <div className={`font-gamer font-black text-sm sm:text-lg tracking-widest uppercase
                        ${loot.isBoss ? 'text-amber-400' : 'text-red-400'}
                    `}>
                        {loot.isBoss ? 'CHEFÃO DERROTADO!' : 'INIMIGO DERROTADO'}
                    </div>
                    <div className="text-slate-500 text-[10px] sm:text-xs mt-0.5 font-bold uppercase tracking-wider">{loot.enemyName}</div>
                </div>

                <div className="flex gap-1.5 sm:gap-2 justify-center mb-2 sm:mb-3 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-amber-950/70 border border-amber-700/50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl">
                        <span className="text-base sm:text-xl">🪙</span>
                        <div className="text-left">
                            <div className="text-[8px] sm:text-[9px] text-amber-400/70 font-bold uppercase tracking-wider">Ouro</div>
                            <div className="text-amber-300 font-mono font-black text-sm sm:text-base">+{loot.gold}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-indigo-950/70 border border-indigo-700/50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl">
                        <span className="text-base sm:text-xl">⭐</span>
                        <div className="text-left">
                            <div className="text-[8px] sm:text-[9px] text-indigo-400/70 font-bold uppercase tracking-wider">XP</div>
                            <div className="text-indigo-300 font-mono font-black text-sm sm:text-base">+{loot.xp}</div>
                        </div>
                    </div>
                    {loot.diamonds && loot.diamonds > 0 && (
                        <div className="flex items-center gap-1.5 bg-cyan-950/70 border border-cyan-700/50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl">
                            <span className="text-base sm:text-xl">💎</span>
                            <div className="text-left">
                                <div className="text-[8px] sm:text-[9px] text-cyan-400/70 font-bold uppercase tracking-wider">Gema</div>
                                <div className="text-cyan-300 font-mono font-black text-sm sm:text-base">+{loot.diamonds}</div>
                            </div>
                        </div>
                    )}
                </div>

                {loot.drops.length > 0 && (
                    <div>
                        <div className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-widest mb-1.5 sm:mb-2 font-bold">— Espólio —</div>
                        <div className="flex gap-1.5 justify-center flex-wrap">
                            {loot.drops.map((item, i) => (
                                <div key={i} className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-bold
                                    ${item.rarity === 'gold' ? 'bg-amber-900/40 border-amber-600/50 text-amber-200'
                                    : item.rarity === 'silver' ? 'bg-slate-800/60 border-slate-500/50 text-slate-200'
                                    : 'bg-slate-900/60 border-slate-700 text-slate-300'}
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
                const verticalStackOffset = stackIndex * 34;
                
                let colorClass = "text-white";
                if (t.type === 'damage') colorClass = "text-red-500";
                if (t.type === 'heal') colorClass = "text-green-400";
                if (isCrit) colorClass = "text-amber-400";
                if (isBuff) colorClass = "text-blue-400";

                return (
                    <div 
                        key={t.id}
                        className={`absolute font-black ${colorClass} drop-shadow-[0_2px_2px_rgba(0,0,0,1)] flex items-center justify-center rounded-xl border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur-[2px]`}
                        style={{
                            left: `calc(${leftPos} + ${Math.round(t.xOffset * 0.22)}px)`,
                            top: `calc(${topPos} + ${Math.round(t.yOffset * 0.12) + verticalStackOffset}px)`,
                            fontSize: isCrit ? '2.1rem' : isBuff ? '1.2rem' : '1.55rem',
                            minWidth: isCrit ? '7.5rem' : '5.5rem',
                            animation: `floatUp 1s forwards ease-out`,
                            zIndex: 100
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
                           {slot.item && <div className="text-[10px] text-indigo-300">+{slot.item.value} {slot.item.type === 'weapon' ? 'ATK' : 'DEF'}</div>}
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
    onAlchemist: () => void,
    onChangeClass: (classId: Player['classId']) => void,
  shopItems: Item[],
  onEquipItem: (item: Item) => void,
  onUseItem: (itemId: string) => void
}> = ({ player, stage, killCount, dungeonEvolution, dungeonTotalMonsters, onHunt, onBoss, onDungeon, onShop, onAlchemist, onChangeClass, shopItems, onEquipItem, onUseItem }) => {
  const [showProfile, setShowProfile] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const bossUnlocked = killCount >= 10;
        const currentClass = getPlayerClassById(player.classId);
    const quickActions = [
        {
            id: 'profile',
            label: 'Perfil',
            description: 'Build, equipamentos e cartas escolhidas.',
            icon: <User size={18} />,
            accent: 'text-indigo-200 border-indigo-500/20 bg-indigo-500/10',
            onClick: () => setShowProfile(true),
        },
        {
            id: 'inventory',
            label: 'Mochila',
            description: 'Acesso direto a itens, consumiveis e gear.',
            icon: <ShoppingBag size={18} />,
            accent: 'text-emerald-200 border-emerald-500/20 bg-emerald-500/10',
            onClick: () => setShowInventory(true),
        },
        {
            id: 'merchant',
            label: 'Mercador',
            description: 'Compre armas, armaduras e itens de suporte.',
            icon: <Coins size={18} />,
            accent: 'text-amber-200 border-amber-500/20 bg-amber-500/10',
            onClick: onShop,
        },
        {
            id: 'alchemist',
            label: 'Alquimista',
            description: 'Cartas raras e misturas que nao aparecem no fluxo normal.',
            icon: <FlaskConical size={18} />,
            accent: 'text-fuchsia-200 border-fuchsia-500/20 bg-fuchsia-500/10',
            onClick: onAlchemist,
        },
    ];
  
  return (
    <>
     <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white pointer-events-auto p-4 md:p-8">
                <div className="bg-slate-900 border-2 border-indigo-500/40 p-5 sm:p-8 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92dvh] overflow-y-auto custom-scrollbar flex flex-col gap-6 panel-glow game-surface">
          
                    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.9fr] gap-6">
                        <div className="flex flex-col gap-5">
                            <div className="rounded-[28px] border border-indigo-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-5 sm:p-6 overflow-hidden relative">
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30" />
                                <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-[0.32em] text-indigo-300/80">Hub da Jornada</div>
                                        <h2 className="mt-2 font-gamer text-3xl sm:text-4xl font-black text-indigo-100">Taverna do Abismo</h2>
                                        <p className="mt-2 text-slate-300 max-w-xl">O menu agora funciona como um painel central. Mochila, perfil, mercador e alquimista ficam acessiveis sem precisar atravessar outras telas.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 min-w-full sm:min-w-[18rem] lg:min-w-[20rem]">
                                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Fase</div>
                                            <div className="text-2xl font-black text-white">{stage}</div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Ouro</div>
                                            <div className="text-2xl font-black text-amber-200">{player.gold}</div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Diamantes</div>
                                            <div className="text-2xl font-black text-cyan-200">{player.diamonds}</div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Nivel</div>
                                            <div className="text-2xl font-black text-cyan-100">{player.level}</div>
                                        </div>
                                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 col-span-2 sm:col-span-1">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Classe ativa</div>
                                            <div className="text-xl font-black text-cyan-100">{currentClass.name}</div>
                                            <div className="text-[11px] text-slate-400 mt-1">{currentClass.title}</div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 col-span-2 sm:col-span-1">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">HP Atual</div>
                                            <div className="text-2xl font-black text-emerald-200">{player.stats.hp}/{player.stats.maxHp}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {quickActions.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={action.onClick}
                                        className="group rounded-2xl border border-slate-700 bg-slate-950/70 p-5 text-left transition-all hover:-translate-y-1 hover:border-slate-500 hover:shadow-[0_18px_40px_rgba(2,6,23,0.5)]"
                                    >
                                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${action.accent}`}>
                                            {action.icon}
                                            <span>{action.label}</span>
                                        </div>
                                        <div className="mt-4 text-xl font-black text-white group-hover:text-cyan-100 transition-colors">{action.label}</div>
                                        <p className="mt-2 text-sm text-slate-400 leading-relaxed">{action.description}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="rounded-[28px] border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_38%),linear-gradient(180deg,rgba(8,47,73,0.92),rgba(2,6,23,0.98))] p-5 sm:p-6">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-[0.32em] text-cyan-200/80">Registro de Classes</div>
                                        <h3 className="mt-2 text-2xl font-black text-cyan-50">Troca de classe na taverna</h3>
                                        <p className="mt-2 max-w-2xl text-sm text-slate-300">Cada classe define os atributos-base do heroi. Escolha a que melhor combina com seu estilo e equipe direto pela taverna.</p>
                                    </div>
                                    <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100">
                                        Classe atual: {currentClass.name}
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {PLAYER_CLASSES.map((playerClass) => {
                                        const isActive = playerClass.id === player.classId;

                                        return (
                                            <div key={playerClass.id} className={`rounded-2xl border p-5 transition-all ${isActive ? 'border-cyan-400/40 bg-cyan-500/10 shadow-[0_18px_40px_rgba(8,145,178,0.18)]' : 'border-slate-700 bg-slate-950/70 hover:border-cyan-500/30'}`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/70">{playerClass.title}</div>
                                                        <div className="mt-2 text-2xl font-black text-white">{playerClass.name}</div>
                                                        <p className="mt-2 text-sm leading-relaxed text-slate-300">{playerClass.description}</p>
                                                    </div>
                                                    <div className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${isActive ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
                                                        {isActive ? 'Ativa' : 'Disponivel'}
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">HP</div>
                                                        <div className="mt-1 font-black text-emerald-200">{playerClass.baseStats.maxHp}</div>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">MP</div>
                                                        <div className="mt-1 font-black text-sky-200">{playerClass.baseStats.maxMp}</div>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">ATK</div>
                                                        <div className="mt-1 font-black text-amber-200">{playerClass.baseStats.atk}</div>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">DEF</div>
                                                        <div className="mt-1 font-black text-indigo-200">{playerClass.baseStats.def}</div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => onChangeClass(playerClass.id)}
                                                    disabled={isActive}
                                                    className={`mt-5 w-full rounded-xl px-4 py-3 font-black uppercase tracking-[0.2em] transition-all ${isActive ? 'cursor-default border border-cyan-300/20 bg-cyan-300/10 text-cyan-100' : 'border border-cyan-400/30 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/20 hover:-translate-y-0.5'}`}
                                                >
                                                    {isActive ? 'Classe equipada' : 'Equipar classe'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col justify-center gap-4 rounded-[28px] border border-slate-700 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.12),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] p-5 sm:p-6">
                         <div className="text-center mb-2">
                <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Progresso da Fase</h3>
                <div className="flex items-center justify-center gap-2">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-600 transition-all" style={{width: `${Math.min(100, (killCount/10)*100)}%`}} />
                    </div>
                    <span className="text-sm font-mono">{Math.min(10, killCount)}/10</span>
                </div>
                {bossUnlocked && <div className="text-red-500 font-bold text-xs mt-1 animate-pulse">CHEFÃO DESBLOQUEADO!</div>}
             </div>

                 <button onClick={onHunt} className="w-full py-5 sm:py-6 bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-500/50 rounded-xl font-black text-lg sm:text-xl transition-all hover:scale-[1.02] shadow-lg flex flex-col items-center group panel-glow">
                <span className="flex items-center gap-2"><Sword size={24} className="group-hover:rotate-45 transition-transform"/> CAÇAR MONSTROS</span>
                <span className="text-xs font-normal text-indigo-300 opacity-70">Ganhe Ouro e XP</span>
             </button>

             <button 
                onClick={onBoss} 
                disabled={!bossUnlocked}
                className={`w-full py-5 sm:py-6 rounded-xl font-black text-lg sm:text-xl transition-all flex flex-col items-center shadow-lg relative overflow-hidden
                    ${bossUnlocked 
                        ? 'bg-red-900 hover:bg-red-800 border border-red-500 text-white hover:scale-105 cursor-pointer' 
                        : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed grayscale'}
                `}
             >
                <div className="z-10 flex flex-col items-center">
                    <span className="flex items-center gap-2"><Skull size={24} /> ENFRENTAR CHEFÃO</span>
                    <span className="text-xs font-normal opacity-70">{bossUnlocked ? 'Avançar para Próxima Fase' : 'Derrote 10 monstros para liberar'}</span>
                </div>
                {bossUnlocked && <div className="absolute inset-0 bg-red-600/20 animate-pulse" />}
             </button>

             <button onClick={onDungeon} className="w-full py-5 sm:py-6 rounded-xl font-black text-lg sm:text-xl transition-all flex flex-col items-center shadow-lg relative overflow-hidden border border-cyan-500/40 bg-cyan-950/70 hover:bg-cyan-900/70 text-white hover:scale-[1.02]">
                <div className="z-10 flex flex-col items-center">
                    <span className="flex items-center gap-2"><Crosshair size={24} /> ENTRAR NA DUNGEON</span>
                    <span className="text-xs font-normal opacity-70">Evolução {dungeonEvolution} • {dungeonTotalMonsters} monstros, sem fuga e chefão no final</span>
                </div>
             </button>

                 <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4">
                     <div className="flex items-center gap-3 text-cyan-200 font-black uppercase tracking-[0.24em] text-xs">
                          <Crosshair size={16} /> Ciclo da dungeon
                     </div>
                     <p className="mt-2 text-sm text-slate-300">A cada vitória completa a dungeon evolui, os monstros ficam mais fortes e, a cada 3 evoluções, o caminho até o chefão cresce em 10 encontros.</p>
                     <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm">
                         <span className="text-slate-400">Próximo ciclo</span>
                         <span className="font-black text-cyan-100">{dungeonTotalMonsters} encontros antes do chefão</span>
                     </div>
                 </div>

                 <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 px-4 py-4">
                     <div className="flex items-center gap-3 text-fuchsia-200 font-black uppercase tracking-[0.24em] text-xs">
                          <FlaskConical size={16} /> Oferta especial
                     </div>
                     <p className="mt-2 text-sm text-slate-300">O alquimista vende cartas exclusivas e raras em troca dos diamantes encontrados na dungeon.</p>
                     <button onClick={onAlchemist} className="mt-4 w-full rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 font-black text-fuchsia-100 transition-colors hover:bg-fuchsia-500/20">
                          Ver estoque do alquimista
                     </button>
                 </div>
                </div>
          </div>
       </div>
    </div>
    {showProfile && <CharacterSheetModal player={player} shopItems={shopItems} onClose={() => setShowProfile(false)} onOpenInventory={() => { setShowProfile(false); setShowInventory(true); }} />}
    {showInventory && <InventoryModal player={player} shopItems={shopItems} onClose={() => setShowInventory(false)} onEquip={onEquipItem} onUse={onUseItem} />}
    </>
  );
};

const describeCardEffect = (card: ProgressionCard) => {
    return card.effects.map(effect => {
        const value = Number.isInteger(effect.value) ? effect.value : `${Math.round(effect.value * 100)}%`;
        const skillName = effect.skillId ? SKILLS.find(skill => skill.id === effect.skillId)?.name : null;

        switch (effect.type) {
            case 'gold_instant': return `+${value} Ouro agora`;
            case 'xp_instant': return `+${value} XP agora`;
            case 'max_hp': return `+${value} Vida maxima`;
            case 'max_mp': return `+${value} Mana maxima`;
            case 'atk': return `+${value} Ataque`;
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

export const CardChoiceScreen: React.FC<{ offer: CardRewardOffer, cards: ProgressionCard[], onSelect: (card: ProgressionCard) => void }> = ({ offer, cards, onSelect }) => (
    <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 pointer-events-auto animate-[cardScreenFadeIn_0.5s_ease-out_both]">
        <style>{`
            @keyframes cardScreenFadeIn {
                0% { opacity: 0; }
                100% { opacity: 1; }
            }
            @keyframes cardScreenSlideUp {
                0% { opacity: 0; transform: scale(0.92) translateY(30px); }
                100% { opacity: 1; transform: scale(1) translateY(0); }
            }
        `}</style>
        <div className="w-full max-w-6xl max-h-[95vh] sm:max-h-none overflow-y-auto rounded-2xl sm:rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_120px_rgba(107,49,65,0.18)] animate-[cardScreenSlideUp_0.5s_ease-out_both]">
            <div className="border-b border-[#dcc0aa] px-4 py-3 sm:px-8 sm:py-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-3 py-1 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#8d5e29]">
                    <Sparkles size={12} /> Escolha uma carta
                </div>
                <h2 className="mt-2 sm:mt-4 text-xl sm:text-4xl font-black text-[#6b3141]">{offer.source === 'boss' ? 'Recompensa do Chefao' : 'Recompensa de Evolucao'}</h2>
                <p className="mt-1 sm:mt-2 text-xs sm:text-base text-[#7f5b56]">{offer.reason}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 p-3 sm:p-8">
                {cards.map(card => {
                    const category = getCardCategoryBadge(card);
                    const effectLines = describeCardEffect(card);

                    return (
                        <button
                            key={card.id}
                            onClick={() => onSelect(card)}
                            className="group text-left rounded-[16px] sm:rounded-[20px] border border-[#cfab91] bg-[#f7ecdd] p-3.5 sm:p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-[#c59d82]"
                        >
                            <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-4">
                                <div>
                                    <div className="rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.35em] text-[#9a7068] inline-block mb-1 sm:mb-2">{card.rarity}</div>
                                    <h3 className="text-lg sm:text-2xl font-black text-[#6b3141] leading-tight">{card.name}</h3>
                                </div>
                                <div className={`inline-flex items-center gap-1 rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold shrink-0 ${category.color}`}>
                                    {category.icon}
                                    <span>{category.label}</span>
                                </div>
                            </div>

                            <p className="text-xs sm:text-sm text-[#7f5b56] leading-relaxed min-h-8 sm:min-h-12">{card.description}</p>

                            <div className="mt-3 sm:mt-5 space-y-1.5 sm:space-y-2">
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

export const AlchemistScreen: React.FC<{ player: Player, offers: AlchemistCardOffer[], itemOffers: AlchemistItemOffer[], onBuyCard: (offer: AlchemistCardOffer) => void, onBuyItem: (offer: AlchemistItemOffer) => void, onLeave: () => void }> = ({ player, offers, itemOffers, onBuyCard, onBuyItem, onLeave }) => {
    const [selectedType, setSelectedType] = useState<'card' | 'item'>(offers.length > 0 ? 'card' : 'item');
    const [selectedCardOffer, setSelectedCardOffer] = useState<AlchemistCardOffer | null>(offers[0] ?? null);
    const [selectedItemOffer, setSelectedItemOffer] = useState<AlchemistItemOffer | null>(itemOffers[0] ?? null);

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

    const selectedCard = selectedType === 'card' ? selectedCardOffer : null;
    const selectedItem = selectedType === 'item' ? selectedItemOffer : null;

    return (
        <div className="absolute inset-0 z-40 bg-slate-950 text-white flex flex-col pointer-events-auto">
            <header className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 flex flex-wrap gap-3 justify-between items-center shadow-lg z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="game-icon-badge w-10 h-10 text-fuchsia-300"><FlaskConical /></div>
                    <div>
                        <h2 className="font-bold text-xl text-fuchsia-100">Laboratório do Alquimista</h2>
                        <p className="text-xs text-slate-500">Cartas raras e relíquias vendidas apenas por diamantes.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="bg-black/40 px-4 py-2 rounded-full border border-slate-700 flex gap-2 items-center">
                        <Sparkles className="text-cyan-400 w-4 h-4" />
                        <span className="font-mono text-cyan-200">{player.diamonds}</span>
                    </div>
                    <button onClick={onLeave} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded font-bold flex items-center gap-2">
                        <Home size={16} /> Voltar
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
                <div className="w-full xl:w-[26rem] bg-slate-900 border-b xl:border-b-0 xl:border-r border-slate-800 flex flex-col shrink-0 max-h-[44dvh] xl:max-h-none">
                    <div className="p-4 border-b border-slate-800 bg-slate-950/60">
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedType('card')} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.22em] ${selectedType === 'card' ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-100' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
                                Cartas
                            </button>
                            <button onClick={() => setSelectedType('item')} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.22em] ${selectedType === 'item' ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-100' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
                                Relíquias
                            </button>
                        </div>
                        <p className="mt-3 text-sm text-slate-400">Cartas do alquimista são únicas. Relíquias podem ser recompradas quando houver diamantes suficientes.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {selectedType === 'card' ? offers.map(offer => {
                            const isSelected = selectedCardOffer?.id === offer.id;
                            const alreadyOwned = player.chosenCards.includes(offer.card.id);
                            const lockedByLevel = player.level < offer.card.minLevel;

                            return (
                                <button
                                    key={offer.id}
                                    onClick={() => setSelectedCardOffer(offer)}
                                    className={`rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-fuchsia-400/60 bg-slate-800 shadow-lg' : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800'} ${alreadyOwned ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 bg-slate-950/80 flex items-center justify-center text-3xl">{offer.card.icon}</div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{getCardRarityLabel(offer.card.rarity)}</div>
                                                <div className="font-black text-base text-white truncate">{offer.card.name}</div>
                                                <div className="mt-1 text-xs text-slate-400 line-clamp-2">{offer.tagline}</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs font-black text-cyan-300">{offer.cost}💎</div>
                                            <div className="text-[10px] text-slate-500">Lvl {offer.card.minLevel}+</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] border rounded-full px-2.5 py-1 ${getCardCategoryMeta(offer.card).tone}`}>{getCardCategoryMeta(offer.card).label}</span>
                                        {alreadyOwned && <span className="text-[10px] font-bold uppercase tracking-[0.2em] border rounded-full px-2.5 py-1 border-slate-600 bg-slate-800 text-slate-300">Comprada</span>}
                                        {lockedByLevel && <span className="text-[10px] font-bold uppercase tracking-[0.2em] border rounded-full px-2.5 py-1 border-red-500/30 bg-red-500/10 text-red-200">Nivel baixo</span>}
                                    </div>
                                </button>
                            );
                        }) : itemOffers.map(offer => {
                            const isSelected = selectedItemOffer?.id === offer.id;
                            const lockedByLevel = player.level < offer.item.minLevel;
                            const relicMeta = getAlchemistRelicMeta(offer.item);
                            return (
                                <button
                                    key={offer.id}
                                    onClick={() => setSelectedItemOffer(offer)}
                                    className={`rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-cyan-400/60 bg-slate-800 shadow-lg' : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 bg-slate-950/80 flex items-center justify-center text-3xl">{offer.item.icon}</div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Relíquia rara</div>
                                                <div className="font-black text-base text-white truncate">{offer.item.name}</div>
                                                <div className="mt-1 text-xs text-slate-400 line-clamp-2">{offer.tagline}</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs font-black text-cyan-300">{offer.cost}💎</div>
                                            <div className="text-[10px] text-slate-500">Lvl {offer.item.minLevel}+</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] border rounded-full px-2.5 py-1 border-cyan-500/30 bg-cyan-500/10 text-cyan-100">{relicMeta.badge}</span>
                                        {lockedByLevel && <span className="text-[10px] font-bold uppercase tracking-[0.2em] border rounded-full px-2.5 py-1 border-red-500/30 bg-red-500/10 text-red-200">Nivel baixo</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-[radial-gradient(circle_at_top,_rgba(217,70,239,0.14),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))]">
                    {selectedType === 'card' && selectedCard ? (() => {
                        const alreadyOwned = player.chosenCards.includes(selectedCard.card.id);
                        const canAfford = player.diamonds >= selectedCard.cost;
                        const hasLevel = player.level >= selectedCard.card.minLevel;
                        const effectLines = describeCardEffect(selectedCard.card);

                        return (
                            <>
                                <div className="flex-1 overflow-y-auto p-5 sm:p-8">
                                    <div className="rounded-[28px] border border-fuchsia-500/20 bg-slate-950/70 p-6 sm:p-8">
                                        <div className="flex flex-col lg:flex-row lg:items-start gap-6 justify-between">
                                            <div className="max-w-3xl">
                                                <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-fuchsia-200">
                                                    <FlaskConical size={14} /> Exclusiva do alquimista
                                                </div>
                                                <h3 className="mt-4 text-3xl sm:text-4xl font-black text-white">{selectedCard.card.name}</h3>
                                                <p className="mt-3 text-base text-slate-300 leading-relaxed">{selectedCard.card.description}</p>
                                                <p className="mt-4 text-sm text-fuchsia-200/90">{selectedCard.tagline}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 min-w-full sm:min-w-[18rem] lg:min-w-[20rem]">
                                                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Preco</div><div className="text-2xl font-black text-cyan-200">{selectedCard.cost} diamantes</div></div>
                                                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Requisito</div><div className="text-2xl font-black text-cyan-100">Lvl {selectedCard.card.minLevel}</div></div>
                                                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Raridade</div><div className="text-2xl font-black text-fuchsia-100">{getCardRarityLabel(selectedCard.card.rarity)}</div></div>
                                                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Status</div><div className="text-lg font-black text-white">{alreadyOwned ? 'Comprada' : canAfford && hasLevel ? 'Pronta' : 'Bloqueada'}</div></div>
                                            </div>
                                        </div>
                                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {effectLines.map(line => (
                                                <div key={line} className="rounded-2xl border border-slate-800 bg-black/25 px-4 py-3 text-sm font-semibold text-slate-100">{line}</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="border-t border-slate-800 bg-slate-900/90 px-5 sm:px-8 py-5 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                                    <div className="text-sm text-slate-400">{alreadyOwned ? 'Essa carta ja faz parte da sua build e saiu do estoque.' : !hasLevel ? `Alcance o nivel ${selectedCard.card.minLevel} para liberar a compra.` : !canAfford ? 'Junte mais diamantes para adquirir essa formula.' : 'A compra aplica o efeito imediatamente no personagem.'}</div>
                                    <button
                                        onClick={() => onBuyCard(selectedCard)}
                                        disabled={alreadyOwned || !canAfford || !hasLevel}
                                        className={`w-full lg:w-auto px-8 py-4 rounded-xl font-black text-base shadow-xl transition-all flex items-center justify-center gap-3 ${alreadyOwned || !canAfford || !hasLevel ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white hover:-translate-y-1 shadow-[0_12px_30px_rgba(192,38,211,0.35)]'}`}
                                    >
                                        <FlaskConical size={18} /> Comprar carta exclusiva
                                    </button>
                                </div>
                            </>
                        );
                    })() : selectedType === 'item' && selectedItem ? (() => {
                        const canAfford = player.diamonds >= selectedItem.cost;
                        const hasLevel = player.level >= selectedItem.item.minLevel;
                        const ownedQty = player.inventory[selectedItem.item.id] || 0;
                        const relicMeta = getAlchemistRelicMeta(selectedItem.item);
                        return (
                            <>
                                <div className="flex-1 overflow-y-auto p-5 sm:p-8">
                                    <div className="rounded-[28px] border border-cyan-500/20 bg-slate-950/70 p-6 sm:p-8">
                                        <div className="flex flex-col lg:flex-row lg:items-start gap-6 justify-between">
                                            <div className="max-w-3xl">
                                                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                                                    <Sparkles size={14} /> {relicMeta.title}
                                                </div>
                                                <h3 className="mt-4 text-3xl sm:text-4xl font-black text-white">{selectedItem.item.name}</h3>
                                                <p className="mt-3 text-base text-slate-300 leading-relaxed">{selectedItem.item.description}</p>
                                                <p className="mt-4 text-sm text-cyan-200/90">{selectedItem.tagline}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 min-w-full sm:min-w-[18rem] lg:min-w-[20rem]">
                                                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Preco</div><div className="text-2xl font-black text-cyan-200">{selectedItem.cost} diamantes</div></div>
                                                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Requisito</div><div className="text-2xl font-black text-cyan-100">Lvl {selectedItem.item.minLevel}</div></div>
                                                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Estoque</div><div className="text-2xl font-black text-white">x{ownedQty}</div></div>
                                                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Uso</div><div className="text-lg font-black text-white">{relicMeta.useLabel}</div></div>
                                            </div>
                                        </div>
                                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {relicMeta.lines.map(line => (
                                                <div key={line} className="rounded-2xl border border-slate-800 bg-black/25 px-4 py-3 text-sm font-semibold text-slate-100">{line}</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="border-t border-slate-800 bg-slate-900/90 px-5 sm:px-8 py-5 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                                    <div className="text-sm text-slate-400">{!hasLevel ? `Alcance o nivel ${selectedItem.item.minLevel} para liberar a compra.` : !canAfford ? 'Junte mais diamantes para adquirir a relíquia.' : relicMeta.footer}</div>
                                    <button
                                        onClick={() => onBuyItem(selectedItem)}
                                        disabled={!canAfford || !hasLevel}
                                        className={`w-full lg:w-auto px-8 py-4 rounded-xl font-black text-base shadow-xl transition-all flex items-center justify-center gap-3 ${!canAfford || !hasLevel ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white hover:-translate-y-1 shadow-[0_12px_30px_rgba(8,145,178,0.35)]'}`}
                                    >
                                        <Sparkles size={18} /> Comprar relíquia
                                    </button>
                                </div>
                            </>
                        );
                    })() : (
                        <div className="flex-1 flex items-center justify-center text-slate-500">Nenhum item no estoque.</div>
                    )}
                </div>
            </div>
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

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
            <div className={`w-full max-w-4xl rounded-[28px] border overflow-hidden shadow-[0_30px_120px_rgba(0,0,0,0.65)] ${isPositiveOutcome ? 'border-cyan-500/30 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]' : 'border-red-500/30 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.12),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]'}`}>
                <div className="border-b border-slate-800 px-6 py-5 sm:px-8 sm:py-6 text-center">
                    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] ${isPositiveOutcome ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        {isPositiveOutcome ? <Sparkles size={14} /> : <AlertTriangle size={14} />} {badgeLabel}
                    </div>
                    <h2 className={`mt-4 text-3xl sm:text-4xl font-black ${isPositiveOutcome ? 'text-cyan-100' : 'text-red-200'}`}>{title}</h2>
                    <p className="mt-2 text-sm sm:text-base text-slate-400">{result.reason}</p>
                    {result.outcome === 'victory' && result.nextEvolution !== undefined && result.nextTotalMonsters !== undefined && (
                        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs sm:text-sm font-black text-cyan-100">
                            <span>Próxima evolução: {result.nextEvolution}</span>
                            <span className="text-cyan-300/60">•</span>
                            <span>{result.nextTotalMonsters} encontros até o chefão</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-6 sm:p-8">
                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Encontros</div>
                        <div className="text-2xl font-black text-white">{result.rewards.clearedMonsters}/{result.rewards.totalMonsters}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Ouro</div>
                        <div className={`text-2xl font-black ${isPositiveOutcome ? 'text-amber-200' : 'text-red-200'}`}>{isPositiveOutcome ? '+' : '-'}{result.rewards.gold}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">XP</div>
                        <div className={`text-2xl font-black ${isPositiveOutcome ? 'text-indigo-200' : 'text-red-200'}`}>{isPositiveOutcome ? '+' : '-'}{result.rewards.xp}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Diamantes</div>
                        <div className={`text-2xl font-black ${isPositiveOutcome ? 'text-cyan-200' : 'text-red-200'}`}>{isPositiveOutcome ? '+' : '-'}{result.rewards.diamonds}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Chefão</div>
                        <div className={`text-lg font-black ${result.rewards.bossDefeated ? 'text-emerald-200' : 'text-slate-300'}`}>{result.rewards.bossDefeated ? 'Derrotado' : 'Intacto'}</div>
                    </div>
                </div>

                <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                        <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">{isPositiveOutcome ? 'Espólio da dungeon' : 'Tudo perdido na dungeon'}</div>
                        {rewardItems.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {rewardItems.map(({ item, quantity }) => (
                                    <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl border border-white/10 bg-slate-950/80 flex items-center justify-center text-2xl">{item.icon}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-black text-white truncate">{item.name}</div>
                                            <div className="text-xs text-slate-500">x{quantity}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-6 py-10 text-center text-slate-500">Nenhum item ou material foi acumulado.</div>
                        )}
                    </div>

                    <button onClick={onContinue} className={`mt-6 w-full py-4 rounded-xl font-black text-lg transition-all ${isPositiveOutcome ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_12px_30px_rgba(8,145,178,0.35)]' : 'bg-red-700 hover:bg-red-600 text-white shadow-[0_12px_30px_rgba(185,28,28,0.35)]'}`}>
                        {result.outcome === 'victory' ? 'Receber espólio e continuar' : result.outcome === 'withdrawal' ? 'Receber espólio e voltar' : 'Voltar para a taverna'}
                    </button>
                </div>
            </div>
        </div>
    );
};

type ShopFilter = 'all' | 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs' | 'potion';

export const ShopScreen: React.FC<{ player: Player, items: Item[], onBuy: (i: Item) => void, onSell: (i: Item) => void, onLeave: () => void }> = ({ player, items, onBuy, onSell, onLeave }) => {
  return <ShopMenuScreen player={player} items={items} onBuy={onBuy} onSell={onSell} onLeave={onLeave} />;
};

export const BattleHUD: React.FC<GameUIProps> = (props) => {
        const { player, enemy, turnState, logs, onAttack, onDefend, onSkill, onUseItem, currentNarration, gameState, shopItems, floatingTexts, onFlee, onStartBattle, stage, killCount, onEquipItem, isDungeonRun, dungeonRewards, dungeonCleared = 0, dungeonTotal = 30, gameTime } = props;
  const [activeBattleMenu, setActiveBattleMenu] = useState<'skills' | 'items' | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
    const [showFleeConfirm, setShowFleeConfirm] = useState(false);
    const [showDungeonExtractConfirm, setShowDungeonExtractConfirm] = useState(false);
    const [pendingDungeonExtractItem, setPendingDungeonExtractItem] = useState<Item | null>(null);
    const [showDungeonLootPreview, setShowDungeonLootPreview] = useState(false);
    const [showBattleStats, setShowBattleStats] = useState(false);
  const isPlayerTurn = turnState === TurnState.PLAYER_INPUT;
    const canLeaveFreely = !isDungeonRun && killCount >= 10;
    const dungeonRewardItems = Object.entries(dungeonRewards?.drops ?? {})
            .map(([itemId, quantity]) => ({ item: ALL_ITEMS.find(entry => entry.id === itemId), quantity }))
            .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry.item));

  // Filter inventory for usable items (potions)
  const usableItems = shopItems.filter(i => i.type === 'potion' && (player.inventory[i.id] || 0) > 0);
  const describeBattleSkill = (skill: Skill) => {
      if (skill.type === 'heal') {
          return `Cura ${Math.round(skill.damageMult * 100)}% da vida maxima`;
      }

      return `${skill.type === 'magic' ? 'Dano magico' : 'Dano fisico'} x${skill.damageMult.toFixed(1)}${skill.type === 'magic' ? ' • menor chance de desvio' : ''}`;
  };

  const describeBattleItem = (item: Item) => {
      if (item.id === 'pot_dg_recall') return 'Retira voce da dungeon e preserva todo o espolio acumulado';
      if (item.id === 'pot_alc_phantom_veil') return 'Ativa evasao perfeita por 4 turnos';
    if (item.id === 'pot_alc_twin_fang') return 'Duplica ataques basicos e habilidades fisicas por 6 turnos';
      if (item.id === 'pot_atk') return `Aumenta ataque em ${Math.round(item.value * 100)}% por ${item.duration || 3} turnos`;
      if (item.id === 'pot_def') return `Aumenta defesa em ${Math.round(item.value * 100)}% por ${item.duration || 3} turnos`;
      if (item.name.includes('Mana')) return `Recupera ${item.value} MP`;
      return `Recupera ${item.value} HP`;
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between p-2 sm:p-4 pointer-events-none safe-bottom">
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
              <div className="w-full max-w-4xl rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.15)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-4 border-b border-[#dcc0aa] px-5 py-4 sm:px-6">
                      <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9a7068]">Espólio acumulado</div>
                          <h3 className="mt-1 text-xl sm:text-2xl font-black text-[#6b3141]">Ganhos atuais da dungeon</h3>
                      </div>
                      <button onClick={() => setShowDungeonLootPreview(false)} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
                          Fechar
                      </button>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-5 sm:p-6">
                      <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">Encontros</div><div className="text-2xl font-black text-[#6b3141]">{dungeonRewards.clearedMonsters}/{dungeonRewards.totalMonsters}</div></div>
                      <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">Ouro</div><div className="text-2xl font-black text-amber-700">+{dungeonRewards.gold}</div></div>
                      <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">XP</div><div className="text-2xl font-black text-[#7d3d4d]">+{dungeonRewards.xp}</div></div>
                      <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">Diamantes</div><div className="text-2xl font-black text-[#346c7f]">+{dungeonRewards.diamonds}</div></div>
                      <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">Evolução</div><div className="text-2xl font-black text-[#6b3141]">{dungeonRewards.evolution}</div></div>
                  </div>

                  <div className="px-5 sm:px-6 pb-6">
                      <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] p-5">
                          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-[#9a7068] mb-4">Itens acumulados até agora</div>
                          {dungeonRewardItems.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto pr-1">
                                  {dungeonRewardItems.map(({ item, quantity }) => (
                                      <div key={item.id} className="rounded-2xl border border-[#cfab91] bg-[#f7ecdd] px-4 py-3 flex items-center gap-3">
                                          <div className="h-12 w-12 rounded-xl border border-[#dcc0aa] bg-[#f8eddf] flex items-center justify-center text-2xl">{item.icon}</div>
                                          <div className="min-w-0 flex-1">
                                              <div className="font-black text-[#6b3141] truncate">{item.name}</div>
                                              <div className="text-xs text-[#9a7068]">x{quantity}</div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="rounded-2xl border border-dashed border-[#cfab91] bg-[#f4e7d5] px-6 py-10 text-center text-[#8f6c67]">Nenhum item ou material acumulado até agora.</div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeBattleMenu && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto p-4" onClick={() => setActiveBattleMenu(null)}>
              <div className="w-full max-w-2xl rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.15)] overflow-hidden animate-fade-in-down" onClick={event => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-4 border-b border-[#dcc0aa] px-5 py-4 sm:px-6">
                      <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9a7068]">Escolha de batalha</div>
                          <h3 className="mt-1 text-xl sm:text-2xl font-black text-[#6b3141]">{activeBattleMenu === 'skills' ? 'Habilidades' : 'Itens de Batalha'}</h3>
                      </div>
                      <button onClick={() => setActiveBattleMenu(null)} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">
                          Fechar
                      </button>
                  </div>

                  <div className="max-h-[55vh] overflow-y-auto p-4 sm:p-5">
                      {activeBattleMenu === 'skills' ? (
                          player.skills.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {player.skills.map(skill => {
                                      const canCast = player.stats.mp >= skill.manaCost;
                                      return (
                                          <button
                                              key={skill.id}
                                              onClick={() => { onSkill(skill); setActiveBattleMenu(null); }}
                                              disabled={!isPlayerTurn || !canCast}
                                              className={`rounded-2xl border p-4 text-left transition-all ${!isPlayerTurn || !canCast ? 'bg-[#e9d7c2] border-[#dcc0aa] text-[#8f6c67] cursor-not-allowed' : 'bg-violet-100 border-violet-300 text-[#6b3141] hover:bg-violet-50 hover:-translate-y-0.5'}`}
                                          >
                                              <div className="flex items-start justify-between gap-3">
                                                  <div>
                                                      <div className="font-black text-sm sm:text-base">{skill.name}</div>
                                                      <div className="mt-1 text-xs text-[#7f5b56] leading-relaxed">{skill.description}</div>
                                                  </div>
                                                  <div className="rounded-md border border-[#8eb4c0] bg-[#dceff2] px-2 py-1 text-[10px] font-black text-[#346c7f] whitespace-nowrap">
                                                      {skill.manaCost} MP
                                                  </div>
                                              </div>
                                              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c4c76]">{describeBattleSkill(skill)}</div>
                                          </button>
                                      );
                                  })}
                              </div>
                          ) : (
                              <div className="rounded-2xl border border-dashed border-[#cfab91] bg-[#f4e7d5] px-6 py-10 text-center text-sm text-[#8f6c67]">Nenhuma habilidade disponível.</div>
                          )
                      ) : usableItems.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {usableItems.map(item => (
                                  <button
                                      key={item.id}
                                      onClick={() => {
                                          if (item.id === 'pot_dg_recall') {
                                              setPendingDungeonExtractItem(item);
                                              setShowDungeonExtractConfirm(true);
                                              return;
                                          }
                                          onUseItem(item.id);
                                          setActiveBattleMenu(null);
                                      }}
                                      disabled={!isPlayerTurn}
                                      className={`rounded-2xl border p-4 text-left transition-all ${!isPlayerTurn ? 'bg-[#e9d7c2] border-[#dcc0aa] text-[#8f6c67] cursor-not-allowed' : 'bg-amber-100 border-amber-300 text-[#6b3141] hover:bg-amber-50 hover:-translate-y-0.5'}`}
                                  >
                                      <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                              <div className="font-black text-sm sm:text-base flex items-center gap-2"><span>{item.icon}</span><span>{item.name}</span></div>
                                              <div className="mt-1 text-xs text-[#7f5b56] leading-relaxed">{item.description}</div>
                                          </div>
                                          <div className="rounded-md border border-amber-400/40 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 whitespace-nowrap">
                                              x{player.inventory[item.id]}
                                          </div>
                                      </div>
                                      <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b26a2e]">{describeBattleItem(item)}</div>
                                  </button>
                              ))}
                          </div>
                      ) : (
                          <div className="rounded-2xl border border-dashed border-[#cfab91] bg-[#f4e7d5] px-6 py-10 text-center text-sm text-[#8f6c67]">Nenhum item de batalha disponível.</div>
                      )}
                  </div>
              </div>
          </div>
      )}
      
      {/* STAGE PROGRESS HUD (NEW) */}
      <div className="absolute top-0 left-0 w-full flex flex-col items-center pointer-events-none z-20 pt-1 sm:pt-2 px-4 sm:px-0">
          <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-3 sm:px-4 py-1.5 rounded-[14px] w-full sm:w-auto flex items-center justify-center gap-2 sm:gap-4 shadow-xl animate-fade-in-down">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6b3141]">{isDungeonRun ? 'DUNGEON' : `FASE ${stage}`}</span>
              <div className="w-px h-4 bg-[#dcc0aa]"></div>
              <div className="flex items-center gap-2">
                  <div className="w-20 sm:w-24 h-2 bg-[#e9d7c2] rounded-full overflow-hidden border border-[#dcc0aa] relative">
                      <div 
                        className="h-full rounded-full bg-[linear-gradient(90deg,#7d3d4d,#c89a66)] transition-all duration-500" 
                                                style={{ width: `${isDungeonRun ? Math.min(100, (dungeonCleared / dungeonTotal) * 100) : Math.min(100, (killCount / 10) * 100)}%` }}
                      />
                  </div>
                  <span className="text-[10px] font-black text-[#6b3141] min-w-[30px] text-right">
                                        {isDungeonRun ? (dungeonCleared >= dungeonTotal ? <span className="text-rose-500 animate-pulse">CHEFÃO</span> : `${dungeonCleared}/${dungeonTotal}`) : (killCount >= 10 ? <span className="text-rose-500 animate-pulse">CHEFÃO</span> : `${killCount}/10`)}
                  </span>
              </div>
          </div>
          {/* Mobile: Gold + Diamonds + Clock below stage card */}
          <div className="flex sm:hidden items-center justify-center gap-2 mt-1 w-full px-4 pointer-events-auto">
              {!isDungeonRun && gameTime && (
                <div className="bg-white/90 backdrop-blur-md border border-[#ddd] px-2.5 py-1 rounded-[12px] flex items-center gap-1.5 shadow-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className="font-black text-xs text-[#555]">{gameTime}</span>
                </div>
              )}
              <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-2.5 py-1 rounded-[12px] flex items-center gap-1.5 shadow-sm">
                  <GameAssetIcon name="coin" size={14} />
                  <span className="font-black text-xs text-[#6b3141]">{player.gold}</span>
              </div>
              <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-2.5 py-1 rounded-[12px] flex items-center gap-1.5 shadow-sm">
                  <GameAssetIcon name="diamond" size={14} />
                  <span className="font-black text-xs text-[#6b3141]">{player.diamonds}</span>
              </div>
          </div>
      </div>

      {/* GOLD DISPLAY - Desktop only */}
        <div className="absolute top-4 right-4 pointer-events-auto z-20 hidden sm:block">
            <div className="flex items-center gap-2">
                <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-3 py-1.5 rounded-[14px] flex items-center gap-2 shadow-lg animate-fade-in-down">
                    <GameAssetIcon name="coin" size={18} />
                    <span className="font-black text-sm text-[#6b3141]">{player.gold}</span>
                </div>
                <div className="bg-[#f7ecdd]/92 backdrop-blur-md border border-[#cfab91] px-3 py-1.5 rounded-[14px] flex items-center gap-2 shadow-lg animate-fade-in-down">
                    <GameAssetIcon name="diamond" size={18} />
                    <span className="font-black text-sm text-[#6b3141]">{player.diamonds}</span>
                </div>
            </div>
      </div>

      {/* Top Bar: Enemy */}
            <div className="w-full flex justify-center items-start pt-[72px] sm:pt-12 pointer-events-auto px-4 sm:px-0">
        {enemy && (
                    <div className={`backdrop-blur-md border p-2.5 sm:p-3 rounded-[18px] shadow-xl w-full sm:w-auto min-w-[220px] max-w-[400px] sm:max-w-[300px] transition-all relative overflow-hidden
             ${enemy.isBoss ? 'bg-rose-50/95 border-rose-400' : 'bg-[#f7ecdd]/92 border-[#cfab91]'}
          `}>
             {enemy.isBoss && <div className="absolute top-0 right-0 bg-rose-500 text-white text-[8px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded-bl-[12px] z-10">CHEFÃO</div>}
             
             <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                   <Skull size={16} className={enemy.isBoss ? "text-rose-500" : "text-[#9a7068]"} />
                   <span className="font-black text-sm tracking-wide uppercase text-[#6b3141]">{enemy.name}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] bg-[#f4e5d4] border border-[#d6b9a3] px-1.5 py-0.5 rounded-full ml-2 text-[#8d5e29]">Nv. {enemy.level}</span>
             </div>
             <div className="border-t border-[#dcc0aa] pt-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a4151]">HP</span>
                  <span className="text-xs font-black text-[#6b3141]">{enemy.stats.hp}/{enemy.stats.maxHp}</span>
                </div>
                <div className="h-2 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#8d2f46,#d17482)] transition-all duration-500" style={{width: `${Math.max(0, Math.min(100, (enemy.stats.hp/enemy.stats.maxHp)*100))}%`}}></div></div>
             </div>
          </div>
        )}
      </div>

      {/* Logs removed from desktop per user request */}

      {/* Bottom: Player Stats & Controls */}
        <div className="relative w-full max-w-5xl mx-auto pointer-events-auto mb-2 sm:mb-4">
         
            <div className="flex flex-row gap-2 sm:gap-4 items-end">
             
             {/* Player Status Card - Bottom Left */}
                         <div className="bg-[#f7ecdd]/92 backdrop-blur-md p-2.5 sm:p-3 rounded-[18px] border border-[#cfab91] flex-1 sm:w-[320px] sm:flex-none shadow-xl relative">
                                 <div className="flex justify-between items-center mb-1.5">
                                         <div className="min-w-0">
                                                <div className="text-xs sm:text-sm font-black text-[#6b3141] truncate">{player.name}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] font-bold text-[#8a5a57] truncate">{getPlayerClassById(player.classId).name}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8d5e29] bg-[#f4e5d4] border border-[#d6b9a3] px-1.5 py-0.5 rounded-full">Nv. {player.level}</span>
                                                </div>
                                         </div>
                     <div className="flex gap-1.5 shrink-0">
                         <button 
                            onClick={() => setShowBattleStats(s => !s)}
                            className={`p-2 rounded-[12px] transition-colors border ${showBattleStats ? 'bg-[#c59d82] border-[#c59d82] text-white' : 'bg-[#f4e5d4] border-[#dcc0aa] text-[#6b3141] hover:bg-[#e9d7c2]'}`}
                            title="Atributos"
                         >
                             <LayoutGrid size={18} />
                         </button>
                         <button 
                            onClick={() => setShowInventory(true)}
                            className="bg-[#f4e5d4] border border-[#dcc0aa] text-[#6b3141] hover:bg-[#e9d7c2] p-2 rounded-[12px] transition-colors"
                            title="Mochila"
                         >
                             <GameAssetIcon name="bag" size={20} />
                         </button>
                         <button 
                            onClick={() => setShowProfile(true)}
                            className="bg-[#f4e5d4] border border-[#dcc0aa] text-[#6b3141] hover:bg-[#e9d7c2] p-2 rounded-[12px] transition-colors"
                            title="Ver Perfil"
                         >
                             <GameAssetIcon name="book" size={20} />
                         </button>
                     </div>
                 </div>

                 {!showBattleStats ? (
                   <div className="border-t border-[#dcc0aa] mt-1.5 pt-1.5 space-y-1">
                     <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a4151]">HP</span>
                          <span className="text-[11px] font-black text-[#6b3141]">{player.stats.hp}/{player.stats.maxHp}</span>
                        </div>
                        <div className="h-1.5 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#8d2f46,#d17482)]" style={{width: `${(player.stats.hp/player.stats.maxHp)*100}%`}}></div></div>
                     </div>
                     <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#346c7f]">Mana</span>
                          <span className="text-[11px] font-black text-[#6b3141]">{player.stats.mp}/{player.stats.maxMp}</span>
                        </div>
                        <div className="h-1.5 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#2b6878,#66b8d2)]" style={{width: `${(player.stats.mp/player.stats.maxMp)*100}%`}}></div></div>
                     </div>
                     <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a7068]">XP</span>
                          <span className="text-[11px] font-black text-[#6b3141]">{player.xp}/{player.xpToNext}</span>
                        </div>
                        <div className="h-1 bg-[#e9d7c2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[linear-gradient(90deg,#7d3d4d,#c89a66)]" style={{width: `${(player.xp/player.xpToNext)*100}%`}}></div></div>
                     </div>
                   </div>
                 ) : (
                   <div className="border-t border-[#dcc0aa] mt-1.5 pt-1.5 grid grid-cols-4 gap-1">
                       <div className="rounded-[10px] border border-[#d6b9a3] bg-[#f4e5d4] px-1.5 py-1 flex flex-col items-center gap-0.5">
                         <div className="flex h-5 w-5 shrink-0 items-center justify-center text-[#b83a4b]"><Sword size={14} /></div>
                         <div className="text-center"><div className="text-[7px] font-black uppercase tracking-[0.12em] text-[#9a7068]">ATK</div><div className="text-xs font-black text-[#b83a4b]">{player.stats.atk}</div></div>
                       </div>
                       <div className="rounded-[10px] border border-[#d6b9a3] bg-[#f4e5d4] px-1.5 py-1 flex flex-col items-center gap-0.5">
                         <div className="flex h-5 w-5 shrink-0 items-center justify-center text-[#4d6780]"><Shield size={14} /></div>
                         <div className="text-center"><div className="text-[7px] font-black uppercase tracking-[0.12em] text-[#9a7068]">DEF</div><div className="text-xs font-black text-[#4d6780]">{player.stats.def}</div></div>
                       </div>
                       <div className="rounded-[10px] border border-[#d6b9a3] bg-[#f4e5d4] px-1.5 py-1 flex flex-col items-center gap-0.5">
                         <div className="flex h-5 w-5 shrink-0 items-center justify-center text-[#7c4c76]"><Zap size={14} /></div>
                         <div className="text-center"><div className="text-[7px] font-black uppercase tracking-[0.12em] text-[#9a7068]">VEL</div><div className="text-xs font-black text-[#7c4c76]">{player.stats.speed}</div></div>
                       </div>
                       <div className="rounded-[10px] border border-[#d6b9a3] bg-[#f4e5d4] px-1.5 py-1 flex flex-col items-center gap-0.5">
                         <div className="flex h-5 w-5 shrink-0 items-center justify-center text-[#b26a2e]"><Star size={14} /></div>
                         <div className="text-center"><div className="text-[7px] font-black uppercase tracking-[0.12em] text-[#9a7068]">SRT</div><div className="text-xs font-black text-[#b26a2e]">{player.stats.luck}</div></div>
                       </div>
                   </div>
                 )}

                 {/* ACTIVE BUFFS INDICATORS */}
                 <div className="flex flex-wrap gap-1 mt-1.5">
                     {player.buffs.atkTurns > 0 && (
                         <div className="flex items-center gap-1.5 bg-[#f7ecdd] text-[#6b3141] px-2 py-1 rounded-[10px] text-[8px] font-black border border-[#cfab91]">
                             <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[#f8eddf]"><Sword size={10} className="text-[#b83a4b]" /></span>
                             <span className="uppercase tracking-[0.12em]">ATK +{(player.buffs.atkMod*100).toFixed(0)}% ({player.buffs.atkTurns}t)</span>
                         </div>
                     )}
                     {player.buffs.defTurns > 0 && (
                         <div className="flex items-center gap-1.5 bg-[#f7ecdd] text-[#6b3141] px-2 py-1 rounded-[10px] text-[8px] font-black border border-[#cfab91]">
                             <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[#f8eddf]"><Shield size={10} className="text-[#4d6780]" /></span>
                             <span className="uppercase tracking-[0.12em]">DEF +{(player.buffs.defMod*100).toFixed(0)}% ({player.buffs.defTurns}t)</span>
                         </div>
                     )}
                     {player.buffs.perfectEvadeTurns > 0 && (
                         <div className="flex items-center gap-1.5 bg-[#f7ecdd] text-[#6b3141] px-2 py-1 rounded-[10px] text-[8px] font-black border border-[#cfab91]">
                             <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[#f8eddf]"><Sparkles size={10} className="text-[#7c4c76]" /></span>
                             <span className="uppercase tracking-[0.12em]">EVADE ({player.buffs.perfectEvadeTurns}t)</span>
                         </div>
                     )}
                     {player.buffs.doubleAttackTurns > 0 && (
                         <div className="flex items-center gap-1.5 bg-[#f7ecdd] text-[#6b3141] px-2 py-1 rounded-[10px] text-[8px] font-black border border-[#cfab91]">
                             <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[#f8eddf]"><Sword size={10} className="text-[#b83a4b]" /></span>
                             <span className="uppercase tracking-[0.12em]">x2 ATK ({player.buffs.doubleAttackTurns}t)</span>
                         </div>
                     )}
                 </div>
             </div>

             {/* Action Grid - Right side on mobile and desktop */}
                 <div className="flex flex-col gap-1 items-end shrink-0 pointer-events-auto sm:fixed sm:bottom-4 sm:right-4 sm:z-30">
                     {/* Boss battle button */}
                     {!isDungeonRun && killCount >= 10 && !enemy?.isBoss && (
                         <button
                            onClick={() => onStartBattle(true)}
                                     className="w-[100px] sm:w-40 rounded-[12px] border border-rose-400 bg-rose-500 py-1.5 text-[9px] sm:text-xs font-black uppercase tracking-[0.12em] text-white transition-all pointer-events-auto hover:bg-rose-600 hover:scale-105 animate-pulse shadow-lg shadow-rose-500/30 flex items-center justify-center gap-1.5"
                         >
                            <Skull size={14} /> ENFRENTAR CHEFÃO
                         </button>
                     )}

                     {!isDungeonRun && !enemy?.isBoss && killCount < 10 && (
                         <button
                            onClick={() => setShowFleeConfirm(true)}
                            disabled={!isPlayerTurn}
                            className={`self-end rounded-[10px] border px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] transition-colors pointer-events-auto ${!isPlayerTurn ? 'border-[#dcc0aa] bg-[#e9d7c2] text-[#8f6c67] cursor-not-allowed' : 'border-[#cfab91] bg-[#f4e5d4] text-[#6b3141] hover:bg-[#e9d7c2]'}`}
                         >
                            {canLeaveFreely ? 'Sair' : 'Fugir'}
                         </button>
                     )}

                     {isDungeonRun && dungeonRewards && (
                          <button
                              onClick={() => setShowDungeonLootPreview(true)}
                              className="self-end rounded-[10px] border border-[#cfab91] bg-[#f4e5d4] px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-[#6b3141] transition-colors pointer-events-auto hover:bg-[#e9d7c2]"
                          >
                              Espólio
                          </button>
                     )}

                     <div className="grid grid-cols-2 gap-1.5 w-[140px] sm:w-40">
                         <ActionTile icon={<Sword size={18} />} label="ATACAR" onClick={() => { setActiveBattleMenu(null); onAttack(); }} disabled={!isPlayerTurn} variant="attack" />

                         <ActionTile icon={<Shield size={18} />} label="DEFENDER" onClick={() => { setActiveBattleMenu(null); onDefend(); }} disabled={!isPlayerTurn} variant="defense" />

                         <ActionTile icon={<Sparkles size={18} />} label="SKILLS" onClick={() => setActiveBattleMenu(prev => prev === 'skills' ? null : 'skills')} disabled={!isPlayerTurn || player.skills.length === 0} variant="skill" />

                         <ActionTile icon={<FlaskConical size={18} />} label="ITENS" onClick={() => setActiveBattleMenu(prev => prev === 'items' ? null : 'items')} disabled={!isPlayerTurn || usableItems.length === 0} variant="item" />
                     </div>
             </div>
         </div>
      </div>

    {showProfile && <CharacterSheetModal player={player} shopItems={shopItems} onClose={() => setShowProfile(false)} onOpenInventory={() => { setShowProfile(false); setShowInventory(true); }} />}
    {showInventory && <InventoryModal player={player} shopItems={shopItems} onClose={() => setShowInventory(false)} onEquip={onEquipItem} onUse={onUseItem} />}
    </div>
  );
};
