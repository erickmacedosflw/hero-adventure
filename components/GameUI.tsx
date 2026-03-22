
import React, { useState, useEffect } from 'react';
import { Player, Enemy, BattleLog, TurnState, Item, Skill, GameState, Stats, FloatingText, Rarity } from '../types';
import { Sword, Shield, Zap, Heart, Coins, ShoppingBag, Skull, Play, Plus, FlaskConical, User, X, Home, LogOut, DollarSign, ArrowLeft, AlertTriangle, MousePointerClick, Filter, Shirt, Footprints, Crown, LayoutGrid, Sparkles } from 'lucide-react';
import { ItemPreviewCanvas } from './Scene3D';

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
  onDistributeStat: (stat: keyof Stats) => void;
  onContinue: () => void; // Used for Level Up or Victory -> Tavern
  onFlee: () => void;
  currentNarration: string;
  shopItems: Item[];
  floatingTexts?: FloatingText[];
  stage: number;
  killCount: number;
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

const StatRow = ({ label, value, onAdd, canAdd }: { label: string, value: number, onAdd?: () => void, canAdd?: boolean }) => (
  <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded mb-1">
    <span className="text-slate-300 font-bold text-sm">{label}</span>
    <div className="flex items-center gap-3">
      <span className="font-mono text-white">{value}</span>
      {onAdd && canAdd && (
        <button onClick={onAdd} className="bg-amber-500 hover:bg-amber-400 text-black rounded p-0.5">
          <Plus size={14} strokeWidth={4} />
        </button>
      )}
    </div>
  </div>
);

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

// --- FLOATING TEXT COMPONENT ---
const FloatingTextOverlay = ({ texts }: { texts: FloatingText[] }) => {
    return (
        <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
            {texts.map(t => {
                const leftPos = t.target === 'player' ? '25%' : '75%';
                const topPos = t.target === 'player' ? '50%' : '45%';
                const isCrit = t.type === 'crit';
                const isBuff = t.type === 'buff';
                
                let colorClass = "text-white";
                if (t.type === 'damage') colorClass = "text-red-500";
                if (t.type === 'heal') colorClass = "text-green-400";
                if (isCrit) colorClass = "text-amber-400";
                if (isBuff) colorClass = "text-blue-400";

                return (
                    <div 
                        key={t.id}
                        className={`absolute font-black ${colorClass} drop-shadow-[0_2px_2px_rgba(0,0,0,1)] flex items-center justify-center`}
                        style={{
                            left: `calc(${leftPos} + ${t.xOffset}px)`,
                            top: `calc(${topPos} + ${t.yOffset}px)`,
                            fontSize: isCrit ? '3rem' : isBuff ? '1.5rem' : '2rem',
                            animation: `floatUp 1s forwards ease-out`,
                            zIndex: 100
                        }}
                    >
                        <style>{`
                            @keyframes floatUp {
                                0% { transform: translateY(0) scale(0.5); opacity: 0; }
                                20% { transform: translateY(-20px) scale(1.2); opacity: 1; }
                                100% { transform: translateY(-80px) scale(1); opacity: 0; }
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
                    <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-500"><ShoppingBag /></div>
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
                {/* LEFT: ITEMS LIST + FILTERS */}
                <div className="w-80 md:w-96 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
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
                                        onClick={() => setSelectedItem(item)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left group
                                            ${isSelected ? 'bg-slate-800 shadow-lg scale-[1.02] z-10' : 'bg-slate-900/50 hover:bg-slate-800'}
                                            ${rarityClass}
                                        `}
                                    >
                                        <div className="w-12 h-12 bg-slate-950 rounded-lg border border-slate-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-bold text-sm truncate text-slate-200 group-hover:text-white">{item.name}</div>
                                            <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                                {item.type === 'potion' ? 'Consumível' : item.type === 'material' ? 'Material' : 'Equipamento'}
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

                {/* RIGHT: ITEM DETAILS */}
                <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-slate-950" />
                    
                    {selectedItem ? (
                        <div className="z-10 w-full max-w-md flex flex-col items-center animate-fade-in-down">
                            <div className="w-48 h-48 mb-6 relative">
                                <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
                                <ItemPreviewCanvas itemType={selectedItem.type} itemId={selectedItem.id} />
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
        </div>
    );
};

const CharacterSheet = ({ player, shopItems, onClose, onOpenInventory }: { player: Player, shopItems: Item[], onClose: () => void, onOpenInventory: () => void }) => {
  const slots = [
      { label: "Arma", item: player.equippedWeapon, icon: "⚔️" },
      { label: "Escudo", item: player.equippedShield, icon: "🛡️" },
      { label: "Capacete", item: player.equippedHelmet, icon: "🪖" },
      { label: "Armadura", item: player.equippedArmor, icon: "👕" },
      { label: "Pernas", item: player.equippedLegs, icon: "👢" },
  ];

  return (
  <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto" onClick={onClose}>
     <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-4xl w-full shadow-2xl relative animate-fade-in-down" onClick={e => e.stopPropagation()}>
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
                        <div className="w-12 h-12 bg-slate-900 rounded border border-slate-700 flex items-center justify-center text-2xl relative shrink-0">
                             {slot.item ? slot.item.icon : slot.icon}
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
                      Nenhuma habilidade aprendida. Suba de nível para desbloquear!
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
     </div>
  </div>
  )
}

// --- SCREENS ---

export const MenuScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white pointer-events-auto">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-black to-black" />
    <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-indigo-600 mb-4 tracking-tighter text-center drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]">
      ABISMO<br/>VOXEL
    </h1>
    <p className="mb-12 text-slate-400 font-mono text-sm">RPG TÁTICO RETRO-FUTURISTA</p>
    <button onClick={onStart} className="group relative px-16 py-6 bg-indigo-600 hover:bg-indigo-500 rounded-none skew-x-[-10deg] font-black text-2xl transition-all hover:translate-y-[-2px] shadow-[5px_5px_0px_rgba(255,255,255,0.2)] flex items-center gap-4">
      <span className="skew-x-[10deg] flex items-center gap-2"><Play fill="currentColor" /> INICIAR JORNADA</span>
    </button>
  </div>
);

export const TavernScreen: React.FC<{ 
  player: Player, 
  stage: number, 
  killCount: number, 
  onHunt: () => void, 
  onBoss: () => void, 
  onShop: () => void,
  shopItems: Item[],
  onEquipItem: (item: Item) => void,
  onUseItem: (itemId: string) => void
}> = ({ player, stage, killCount, onHunt, onBoss, onShop, shopItems, onEquipItem, onUseItem }) => {
  const [showProfile, setShowProfile] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const bossUnlocked = killCount >= 10;
  
  return (
    <>
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white pointer-events-auto">
       <div className="bg-slate-900 border-2 border-indigo-500/50 p-8 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col md:flex-row gap-8">
          
          {/* Left: Player Status & Profile Access */}
          <div className="flex-1 flex flex-col gap-4">
             <div className="border-b border-slate-700 pb-4">
                <h2 className="text-3xl font-black text-indigo-400 mb-1">TAVERNA</h2>
                <p className="text-slate-400 text-sm">Santuário seguro - Fase {stage}</p>
             </div>
             
             <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col gap-2">
                 <div className="flex items-center gap-3 mb-2">
                     <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xl border-2 border-white">
                         {player.name.charAt(0)}
                     </div>
                     <div>
                         <div className="font-bold text-lg">{player.name}</div>
                         <div className="text-xs text-slate-400">Nível {player.level}</div>
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 text-sm">
                     <div className="bg-black/30 p-2 rounded">HP: <span className="text-green-400 font-bold">{player.stats.hp}/{player.stats.maxHp}</span></div>
                     <div className="bg-black/30 p-2 rounded">Ouro: <span className="text-amber-400 font-bold">{player.gold}</span></div>
                 </div>

                 <button 
                    onClick={() => setShowProfile(true)} 
                    className="mt-2 w-full py-3 bg-slate-700 hover:bg-slate-600 rounded font-bold flex items-center justify-center gap-2 transition-all text-sm"
                 >
                    <User size={16} /> VER PERFIL / EQUIPAMENTOS
                 </button>
             </div>

             <button onClick={onShop} className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                <ShoppingBag className="text-amber-400" /> Acessar Loja
             </button>
          </div>

          {/* Right: Actions */}
          <div className="flex-1 flex flex-col justify-center gap-4 border-l border-slate-800 pl-0 md:pl-8">
             <div className="text-center mb-4">
                <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Progresso da Fase</h3>
                <div className="flex items-center justify-center gap-2">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-600 transition-all" style={{width: `${Math.min(100, (killCount/10)*100)}%`}} />
                    </div>
                    <span className="text-sm font-mono">{Math.min(10, killCount)}/10</span>
                </div>
                {bossUnlocked && <div className="text-red-500 font-bold text-xs mt-1 animate-pulse">CHEFÃO DESBLOQUEADO!</div>}
             </div>

             <button onClick={onHunt} className="w-full py-6 bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-500/50 rounded-xl font-black text-xl transition-all hover:scale-105 shadow-lg flex flex-col items-center group">
                <span className="flex items-center gap-2"><Sword size={24} className="group-hover:rotate-45 transition-transform"/> CAÇAR MONSTROS</span>
                <span className="text-xs font-normal text-indigo-300 opacity-70">Ganhe Ouro e XP</span>
             </button>

             <button 
                onClick={onBoss} 
                disabled={!bossUnlocked}
                className={`w-full py-6 rounded-xl font-black text-xl transition-all flex flex-col items-center shadow-lg relative overflow-hidden
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
          </div>
       </div>
    </div>
    {showProfile && <CharacterSheet player={player} shopItems={shopItems} onClose={() => setShowProfile(false)} onOpenInventory={() => { setShowProfile(false); setShowInventory(true); }} />}
    {showInventory && <InventoryScreen player={player} shopItems={shopItems} onClose={() => setShowInventory(false)} onEquip={onEquipItem} onUse={onUseItem} />}
    </>
  );
};

export const LevelUpScreen: React.FC<{ player: Player, onDistribute: (s: keyof Stats) => void, onContinue: () => void }> = ({ player, onDistribute, onContinue }) => (
  <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 pointer-events-auto">
    <div className="bg-slate-900 border border-amber-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in-down">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-black text-amber-400 mb-1">NÍVEL {player.level}!</h2>
        <p className="text-slate-400">Você ficou mais forte.</p>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4 bg-amber-900/20 p-3 rounded-lg border border-amber-500/20">
          <span className="text-amber-200 font-bold">Pontos Disponíveis</span>
          <span className="text-2xl font-black text-amber-400">{player.statPoints}</span>
        </div>

        <div className="space-y-2">
          <StatRow label="Vitalidade (Max HP)" value={player.stats.maxHp} onAdd={() => onDistribute('maxHp')} canAdd={player.statPoints > 0} />
          <StatRow label="Energia (Max MP)" value={player.stats.maxMp} onAdd={() => onDistribute('maxMp')} canAdd={player.statPoints > 0} />
          <StatRow label="Força (Ataque)" value={player.stats.atk} onAdd={() => onDistribute('atk')} canAdd={player.statPoints > 0} />
          <StatRow label="Defesa (Armadura)" value={player.stats.def} onAdd={() => onDistribute('def')} canAdd={player.statPoints > 0} />
          <StatRow label="Agilidade (Velocidade)" value={player.stats.speed} onAdd={() => onDistribute('speed')} canAdd={player.statPoints > 0} />
          <StatRow label="Sorte (Crítico)" value={player.stats.luck} onAdd={() => onDistribute('luck')} canAdd={player.statPoints > 0} />
        </div>
      </div>

      <button 
        onClick={onContinue}
        disabled={player.statPoints > 0}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all
          ${player.statPoints > 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'}
        `}
      >
        {player.statPoints > 0 ? 'Distribua os pontos' : 'Voltar para Taverna'}
      </button>
    </div>
  </div>
);

type ShopFilter = 'all' | 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs' | 'potion';

export const ShopScreen: React.FC<{ player: Player, items: Item[], onBuy: (i: Item) => void, onSell: (i: Item) => void, onLeave: () => void }> = ({ player, items, onBuy, onSell, onLeave }) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [filter, setFilter] = useState<ShopFilter>('all');

  // Helper: Rarity Weight for sorting
  const getRarityWeight = (r: string) => {
      if (r === 'bronze') return 1;
      if (r === 'silver') return 2;
      if (r === 'gold') return 3;
      return 0;
  }

  // Filter & Sort Logic
  const filteredItems = items
    .filter(item => item.type !== 'material') // Do not show materials in the buy list
    .filter(item => {
        if (filter === 'all') return true;
        return item.type === filter;
    })
    .sort((a, b) => {
        // First by rarity (ASC)
        const diff = getRarityWeight(a.rarity) - getRarityWeight(b.rarity);
        if (diff !== 0) return diff;
        // Then by price (ASC)
        return a.cost - b.cost;
    });

  // Seleciona o primeiro item ao mudar filtro ou abrir
  useEffect(() => {
      if (filteredItems.length > 0 && (!selectedItem || !filteredItems.find(i => i.id === selectedItem.id))) {
          setSelectedItem(filteredItems[0]);
      } else if (filteredItems.length === 0) {
          setSelectedItem(null);
      }
  }, [filter, items]);

  const filters: { id: ShopFilter, label: string, icon: React.ReactNode }[] = [
      { id: 'all', label: 'Todos', icon: <LayoutGrid size={16} /> },
      { id: 'potion', label: 'Itens', icon: <FlaskConical size={16} /> },
      { id: 'weapon', label: 'Armas', icon: <Sword size={16} /> },
      { id: 'shield', label: 'Escudos', icon: <Shield size={16} /> },
      { id: 'helmet', label: 'Capacetes', icon: <Crown size={16} /> },
      { id: 'armor', label: 'Armaduras', icon: <Shirt size={16} /> },
      { id: 'legs', label: 'Botas', icon: <Footprints size={16} /> },
  ];

  return (
  <div className="absolute inset-0 z-40 bg-slate-950 text-white flex flex-col pointer-events-auto">
    <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-lg z-10 shrink-0">
      <div className="flex items-center gap-3">
        <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500"><ShoppingBag /></div>
        <div>
           <h2 className="font-bold text-xl text-amber-100">Mercador do Vazio</h2>
           <p className="text-xs text-slate-500">Compre equipamentos ou venda seu espólio.</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
         <div className="bg-black/40 px-4 py-2 rounded-full border border-slate-700 flex gap-2 items-center">
            <Coins className="text-amber-400 w-4 h-4" />
            <span className="font-mono text-amber-200">{player.gold}</span>
         </div>
         <button onClick={onLeave} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded font-bold flex items-center gap-2">
             <Home size={16}/> Voltar
         </button>
      </div>
    </header>

    <div className="flex-1 flex overflow-hidden">
        {/* LEFT: ITEMS LIST + FILTERS */}
        <div className="w-80 md:w-96 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            {/* Filter Tabs */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/50">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Filtrar por</h3>
                <div className="flex flex-wrap gap-1">
                    {filters.map(f => (
                        <button 
                            key={f.id}
                            onClick={() => setFilter(f.id)} 
                            className={`p-2 rounded flex items-center gap-2 text-xs font-bold flex-grow justify-center transition-colors
                                ${filter === f.id 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
                            `}
                            title={f.label}
                        >
                            {f.icon} {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                <h3 className="font-bold text-xs text-slate-500 uppercase tracking-widest px-1">
                    Catálogo
                </h3>
                {filteredItems.length === 0 && <div className="text-center text-slate-600 p-8 text-sm italic border border-dashed border-slate-800 rounded-lg m-2">Nenhum item encontrado.</div>}
                
                {filteredItems.map(item => {
                    const isSelected = selectedItem?.id === item.id;
                    const rarityClass = getRarityColor(item.rarity);
                    
                    return (
                        <div 
                            key={item.id} 
                            onClick={() => setSelectedItem(item)}
                            className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border border-l-4 relative overflow-hidden group shrink-0
                                ${isSelected 
                                    ? `${rarityClass} bg-slate-800 shadow-lg translate-x-1` 
                                    : `border-transparent bg-slate-800/40 text-slate-400 border-l-${item.rarity === 'gold' ? 'amber-900' : item.rarity === 'silver' ? 'slate-600' : 'orange-900'}`}
                                hover:bg-slate-800 hover:shadow-md
                            `}
                        >
                            <div className={`text-3xl relative z-10 p-2 rounded-lg bg-black/20 ${isSelected ? 'scale-110' : 'scale-100'} transition-transform`}>
                                {item.icon}
                            </div>
                            <div className="flex-1 relative z-10 min-w-0">
                                <div className={`font-bold text-base truncate ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{item.name}</div>
                                <div className="flex justify-between items-center mt-2">
                                    <div className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded text-amber-200/80 flex items-center gap-1">
                                        <DollarSign size={10}/> {item.cost}
                                    </div>
                                    <div className={`text-[10px] px-2 py-0.5 rounded uppercase font-black tracking-wider border
                                        ${item.rarity === 'gold' ? 'border-amber-500/20 text-amber-500' : item.rarity === 'silver' ? 'border-slate-400/20 text-slate-400' : 'border-orange-700/20 text-orange-500'}
                                    `}>
                                        {item.rarity === 'bronze' ? 'Comum' : item.rarity === 'silver' ? 'Raro' : 'Lendário'}
                                    </div>
                                </div>
                            </div>
                            {isSelected && <MousePointerClick size={20} className="text-amber-500 relative z-10 animate-pulse" />}
                        </div>
                    )
                })}
            </div>
        </div>

        {/* CENTER: 3D PREVIEW & DETAILS */}
        <div className="flex-1 bg-black/50 flex flex-col relative">
            {/* 3D Canvas Container */}
            <div className="flex-1 relative bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden flex items-center justify-center">
                {selectedItem ? (
                    <div className="w-full h-full absolute inset-0">
                         <ItemPreviewCanvas itemType={selectedItem.type} itemId={selectedItem.id} />
                         {/* Rarity Badge */}
                         <div className={`absolute top-4 right-4 px-4 py-2 rounded-lg border text-sm font-black uppercase tracking-widest backdrop-blur-sm shadow-xl ${getRarityColor(selectedItem.rarity)}`}>
                             {selectedItem.rarity.toUpperCase()}
                         </div>
                    </div>
                ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-4">
                        <div className="p-6 bg-slate-900 rounded-full border border-slate-800">
                            <ShoppingBag size={64} strokeWidth={1} />
                        </div>
                        <span className="text-lg">Selecione um item da lista</span>
                    </div>
                )}
            </div>

            {/* Item Action Bar */}
            <div className="h-auto min-h-[140px] bg-slate-900 border-t border-slate-800 p-8 flex flex-col md:flex-row gap-8 items-center justify-between shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-20">
                 {selectedItem && (
                     <>
                        <div className="flex-1">
                            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">{selectedItem.name}</h2>
                            <p className="text-slate-400 text-base mb-4 leading-relaxed">{selectedItem.description}</p>
                            <div className="flex gap-3 text-sm font-bold">
                                <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded text-indigo-300">Lvl {selectedItem.minLevel}+</span>
                                <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded text-emerald-300 flex items-center gap-2">
                                    {selectedItem.type === 'weapon' && <Sword size={14}/>}
                                    {['armor', 'helmet', 'legs', 'shield'].includes(selectedItem.type) && <Shield size={14}/>}
                                    {selectedItem.type === 'potion' && <Heart size={14}/>}
                                    
                                    {selectedItem.type === 'weapon' ? `+${selectedItem.value} Ataque` : 
                                     selectedItem.type === 'potion' && !selectedItem.id.includes('pot_atk') && !selectedItem.id.includes('pot_def') ? `Recupera ${selectedItem.value}` : 
                                     selectedItem.id.includes('pot_atk') ? `+${selectedItem.value * 100}% ATK` :
                                     selectedItem.id.includes('pot_def') ? `+${selectedItem.value * 100}% DEF` :
                                     `+${selectedItem.value} Defesa`}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                             {(() => {
                                 const canAfford = player.gold >= selectedItem.cost;
                                 const hasLevel = player.level >= selectedItem.minLevel;
                                 const isEquipped = 
                                     (player.equippedWeapon?.id === selectedItem.id) || 
                                     (player.equippedArmor?.id === selectedItem.id) ||
                                     (player.equippedHelmet?.id === selectedItem.id) ||
                                     (player.equippedLegs?.id === selectedItem.id) ||
                                     (player.equippedShield?.id === selectedItem.id);
                                 
                                 return (
                                    <button 
                                        onClick={() => onBuy(selectedItem)}
                                        disabled={!canAfford || isEquipped || !hasLevel}
                                        className={`px-10 py-5 rounded-xl font-black text-lg shadow-xl transition-all flex items-center gap-3 transform hover:-translate-y-1
                                            ${isEquipped ? 'bg-slate-800 text-slate-500 cursor-default shadow-none hover:translate-y-0' : 
                                            !hasLevel ? 'bg-slate-800 text-red-500 border border-red-900 cursor-not-allowed hover:translate-y-0' :
                                            canAfford ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/50' : 'bg-slate-800 text-slate-500 border border-slate-700'}
                                        `}
                                    >
                                        {isEquipped ? 
                                            <span className="flex items-center gap-2"><User size={20}/> EQUIPADO</span> : 
                                         !hasLevel ? 
                                            <span className="flex items-center gap-2"><AlertTriangle size={20}/> LVL {selectedItem.minLevel} NECESSÁRIO</span> : 
                                         canAfford ? 
                                            <>COMPRAR <span className="bg-black/20 px-2 py-1 rounded text-amber-200 flex items-center gap-1"><Coins size={16}/> {selectedItem.cost}</span></> : 
                                            <span className="flex items-center gap-2">FALTA OURO <span className="text-red-400">({selectedItem.cost - player.gold})</span></span>
                                        }
                                    </button>
                                 )
                             })()}
                        </div>
                     </>
                 )}
            </div>
        </div>

        {/* RIGHT: INVENTORY SELL (COMPACT) */}
        <div className="w-48 md:w-64 bg-slate-950 border-l border-slate-900 overflow-y-auto p-4 hidden sm:block shrink-0">
            <h3 className="font-bold text-xs text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><DollarSign size={14}/> Vender Itens</h3>
            <div className="space-y-2">
                {Object.entries(player.inventory).map(([id, qty]) => {
                    if((qty as number) <= 0) return null;
                    const itemDef = items.find(i => i.id === id);
                    if (!itemDef) return null;
                    const sellPrice = Math.floor(itemDef.cost / 2);
                    const rarityClass = getRarityColor(itemDef.rarity);

                    return (
                        <button 
                            key={id} 
                            onClick={() => onSell(itemDef)}
                            className={`w-full text-left bg-slate-900 hover:bg-red-900/20 hover:border-red-500/50 p-3 rounded-lg border transition-all group ${rarityClass}`}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-2xl bg-black/30 p-1 rounded">{itemDef.icon}</span>
                                <span className="bg-black/40 px-2 py-0.5 rounded text-[10px] text-white font-mono border border-white/10">x{qty}</span>
                            </div>
                            <div className="font-bold text-xs text-slate-300 truncate group-hover:text-white">{itemDef.name}</div>
                            <div className="text-[10px] text-slate-500 group-hover:text-red-300 mt-1 flex items-center gap-1">
                                <span>Vender:</span> <span className="text-amber-400 font-mono">{sellPrice} G</span>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    </div>
  </div>
  );
};

export const BattleHUD: React.FC<GameUIProps> = (props) => {
  const { player, enemy, turnState, logs, onAttack, onDefend, onSkill, onUseItem, currentNarration, gameState, shopItems, floatingTexts, onFlee, stage, killCount, onEquipItem } = props;
  const [showItems, setShowItems] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showFleeConfirm, setShowFleeConfirm] = useState(false);
  const isPlayerTurn = turnState === TurnState.PLAYER_INPUT;

  // Filter inventory for usable items (potions)
  const usableItems = shopItems.filter(i => i.type === 'potion' && (player.inventory[i.id] || 0) > 0);

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 pointer-events-none">
      {/* Floating Text Layer */}
      {floatingTexts && <FloatingTextOverlay texts={floatingTexts} />}

      {/* FLEE CONFIRMATION MODAL */}
      {showFleeConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto">
              <div className="bg-slate-900 border border-red-500 p-6 rounded-xl text-center max-w-xs w-full animate-fade-in-down shadow-2xl shadow-red-900/20">
                  <div className="flex justify-center mb-4">
                      <div className="bg-red-500/20 p-4 rounded-full">
                          <AlertTriangle size={32} className="text-red-500" />
                      </div>
                  </div>
                  <h3 className="text-2xl font-black text-red-500 mb-2">FUGIR?</h3>
                  <p className="text-slate-300 text-sm mb-6">
                      A covardia tem um preço.<br/>
                      Você perderá até <span className="text-amber-400 font-bold">50 de Ouro</span> ao recuar.
                  </p>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setShowFleeConfirm(false)} 
                        className="flex-1 bg-slate-700 py-3 rounded font-bold hover:bg-slate-600 text-white transition-colors"
                      >
                          FICAR
                      </button>
                      <button 
                        onClick={() => { onFlee(); setShowFleeConfirm(false); }} 
                        className="flex-1 bg-red-600 py-3 rounded font-bold hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-colors"
                      >
                          FUGIR
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {/* STAGE PROGRESS HUD (NEW) */}
      <div className="absolute top-0 left-0 w-full flex justify-center pointer-events-none z-20 pt-2">
          <div className="bg-slate-900/90 backdrop-blur border border-slate-700 px-4 py-1.5 rounded-full flex items-center gap-4 shadow-xl animate-fade-in-down">
              <div className="font-black text-indigo-400 text-sm">FASE {stage}</div>
              <div className="w-px h-3 bg-slate-600"></div>
              <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-500" 
                        style={{ width: `${Math.min(100, (killCount / 10) * 100)}%` }}
                      />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 font-bold min-w-[30px] text-right">
                    {killCount >= 10 ? <span className="text-red-500 animate-pulse">CHEFÃO</span> : `${killCount}/10`}
                  </span>
              </div>
          </div>
      </div>

      {/* GOLD DISPLAY (NEW) */}
      <div className="absolute top-4 right-4 pointer-events-auto z-20">
         <div className="bg-black/60 backdrop-blur border border-amber-500/50 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg text-amber-400 animate-fade-in-down">
            <Coins size={18} />
            <span className="font-mono font-bold">{player.gold}</span>
         </div>
      </div>

      {/* Top Bar: Enemy & Narration */}
      <div className="w-full flex justify-center items-start pt-12 pointer-events-auto">
        {enemy && (
          <div className={`backdrop-blur border-2 p-4 rounded-xl shadow-2xl text-white w-full max-w-md transform transition-all hover:scale-105 relative overflow-hidden
             ${enemy.isBoss ? 'bg-red-950/90 border-red-500' : 'bg-black/80 border-slate-700'}
          `}>
             {enemy.isBoss && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-lg z-10">CHEFÃO DE FASE</div>}
             
             <div className="flex justify-between items-center mb-2">
                <h2 className="font-black text-xl tracking-widest flex items-center gap-2 uppercase text-red-100">
                   <Skull className={enemy.isBoss ? "text-red-500 w-6 h-6" : "text-slate-400"} /> {enemy.name}
                </h2>
                <span className="text-xs bg-white/10 px-2 py-1 rounded font-bold">LVL {enemy.level}</span>
             </div>
             <ProgressBar current={enemy.stats.hp} max={enemy.stats.maxHp} color="bg-red-600" label="HP" />
             {currentNarration && <div className="text-xs text-center text-white/70 mt-1 font-serif italic line-clamp-2">"{currentNarration}"</div>}
          </div>
        )}
      </div>

      {/* Middle: Logs (Moved to right for balance with side view) */}
      <div className="absolute top-1/4 right-4 w-64 flex flex-col gap-1 pointer-events-none items-end mt-8">
         {logs.slice(0, 5).map((log, i) => (
            <div key={i} className={`px-3 py-1 rounded text-xs md:text-sm font-bold shadow-sm animate-fade-in-left border-r-4 text-right
               ${log.type === 'damage' ? 'bg-red-900/80 border-red-500 text-white' : 
                 log.type === 'heal' ? 'bg-green-900/80 border-green-500 text-white' : 
                 log.type === 'crit' ? 'bg-amber-600/80 border-yellow-300 text-white' : 
                 log.type === 'buff' ? 'bg-blue-900/80 border-blue-500 text-white' :
                 'bg-slate-800/80 border-slate-500 text-slate-200'}
            `}>
               {log.message}
            </div>
         ))}
      </div>

      {/* Bottom: Player Stats & Controls */}
      <div className="w-full max-w-3xl mx-auto pointer-events-auto mb-4">
         
         <div className="flex flex-col md:flex-row gap-4 items-end">
             
             {/* Player Status Card */}
             <div className="bg-black/80 backdrop-blur p-3 rounded-xl border border-slate-700 text-white w-full md:w-1/3 shadow-xl relative">
                 <div className="flex justify-between items-end mb-2">
                     <div>
                        <div className="text-sm text-slate-400 font-bold">HERÓI <span className="text-emerald-400 ml-1">Nv. {player.level}</span></div>
                        <div className="text-2xl font-black text-indigo-400">{player.name}</div>
                     </div>
                     <div className="flex gap-2">
                         <button 
                            onClick={() => setShowInventory(true)}
                            className="bg-slate-700 hover:bg-emerald-600 text-white p-1.5 rounded-lg transition-colors"
                            title="Mochila"
                         >
                             <ShoppingBag size={18} />
                         </button>
                         <button 
                            onClick={() => setShowProfile(true)}
                            className="bg-slate-700 hover:bg-slate-600 text-white p-1.5 rounded-lg transition-colors"
                            title="Ver Perfil"
                         >
                             <User size={18} />
                         </button>
                     </div>
                 </div>
                 
                 <div className="mb-1">
                    <div className="flex justify-between text-[10px] font-bold mb-0.5"><span className="text-green-400">VIDA</span> <span>{player.stats.hp}/{player.stats.maxHp}</span></div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width: `${(player.stats.hp/player.stats.maxHp)*100}%`}}></div></div>
                 </div>
                 <div className="mb-2">
                    <div className="flex justify-between text-[10px] font-bold mb-0.5"><span className="text-blue-400">MANA</span> <span>{player.stats.mp}/{player.stats.maxMp}</span></div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${(player.stats.mp/player.stats.maxMp)*100}%`}}></div></div>
                 </div>

                 {/* ACTIVE BUFFS INDICATORS */}
                 <div className="flex gap-2 mb-2">
                     {player.buffs.atkTurns > 0 && (
                         <div className="flex items-center gap-1 bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded text-[9px] font-bold border border-orange-500/30">
                             <Sword size={10} /> ATK +{(player.buffs.atkMod*100).toFixed(0)}% ({player.buffs.atkTurns}t)
                         </div>
                     )}
                     {player.buffs.defTurns > 0 && (
                         <div className="flex items-center gap-1 bg-green-900/50 text-green-300 px-2 py-0.5 rounded text-[9px] font-bold border border-green-500/30">
                             <Shield size={10} /> DEF +{(player.buffs.defMod*100).toFixed(0)}% ({player.buffs.defTurns}t)
                         </div>
                     )}
                 </div>
                 
                 {/* XP Bar (Real-time) */}
                 <div className="pt-2 border-t border-slate-700/50">
                     <div className="flex justify-between text-[9px] font-mono text-amber-400/80 mb-0.5">
                         <span>XP</span>
                         <span>{player.xp} / {player.xpToNext}</span>
                     </div>
                     <div className="h-1 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-amber-500" style={{width: `${(player.xp/player.xpToNext)*100}%`}}></div></div>
                 </div>
             </div>

             {/* Action Grid */}
             <div className="flex-1 w-full grid grid-cols-5 gap-2 h-28">
                
                <button 
                   onClick={onAttack} 
                   disabled={!isPlayerTurn}
                   className={`col-span-1 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 transition-all active:translate-y-1 active:border-b-0
                      ${isPlayerTurn ? 'bg-red-600 border-red-800 text-white hover:bg-red-500 shadow-lg shadow-red-900/20' : 'bg-slate-800 border-slate-900 text-slate-600'}
                   `}
                >
                   <Sword size={24} />
                   <span className="font-black text-[10px] md:text-xs">ATACAR</span>
                </button>

                <button 
                   onClick={onDefend} 
                   disabled={!isPlayerTurn}
                   className={`col-span-1 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 transition-all active:translate-y-1 active:border-b-0
                      ${isPlayerTurn ? 'bg-blue-600 border-blue-800 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20' : 'bg-slate-800 border-slate-900 text-slate-600'}
                   `}
                >
                   <Shield size={24} />
                   <span className="font-black text-[10px] md:text-xs">DEFENDER</span>
                </button>

                <div className="col-span-2 grid grid-cols-2 gap-2 relative">
                   {player.skills.map(skill => {
                      const canCast = player.stats.mp >= skill.manaCost;
                      return (
                        <button 
                            key={skill.id}
                            onClick={() => onSkill(skill)}
                            disabled={!isPlayerTurn || !canCast}
                            className={`rounded-lg p-1 border flex flex-col justify-center items-center transition-all text-[10px]
                                ${!isPlayerTurn ? 'bg-slate-900 border-slate-800 text-slate-600' : 
                                  canCast ? 'bg-indigo-900/90 border-indigo-500 text-indigo-200 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-50'}
                            `}
                        >
                            <span className="font-bold truncate w-full text-center">{skill.name}</span>
                            <span className="font-mono text-[8px] opacity-70">{skill.manaCost} MP</span>
                        </button>
                      )
                   })}
                   {Array.from({length: 4 - player.skills.length}).map((_, i) => (
                       <div key={i} className="bg-slate-900/30 rounded-lg border border-slate-800/30" />
                   ))}
                </div>

                <div className="col-span-1 flex flex-col gap-2 relative">
                    <button 
                       onClick={() => setShowItems(!showItems)} 
                       disabled={!isPlayerTurn}
                       className={`flex-1 rounded-xl flex items-center justify-center gap-2 border-b-4 transition-all
                          ${isPlayerTurn ? 'bg-amber-600 border-amber-800 text-white hover:bg-amber-500' : 'bg-slate-800 border-slate-900 text-slate-600'}
                       `}
                    >
                       <FlaskConical size={18} />
                       <span className="font-black text-[10px]">ITENS</span>
                    </button>
                    
                    {/* FLEE BUTTON - TRIGGERS MODAL */}
                    <button 
                       onClick={() => setShowFleeConfirm(true)}
                       disabled={!isPlayerTurn || enemy?.isBoss}
                       className={`flex-1 rounded-xl flex items-center justify-center gap-2 border-b-4 transition-all
                          ${!isPlayerTurn || enemy?.isBoss 
                              ? 'bg-slate-800 border-slate-900 text-slate-600 cursor-not-allowed' 
                              : 'bg-slate-700 border-slate-800 text-slate-300 hover:bg-slate-600 hover:text-white'}
                       `}
                    >
                       <LogOut size={18} />
                       <span className="font-black text-[10px]">{enemy?.isBoss ? 'BLOQUEADO' : 'FUGIR'}</span>
                    </button>

                    {showItems && isPlayerTurn && (
                       <div className="absolute bottom-full mb-2 right-0 w-48 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-xl flex flex-col gap-1 z-[100] pointer-events-auto animate-fade-in-down">
                          {usableItems.length === 0 && <div className="p-2 text-xs text-slate-500 text-center">Mochila vazia</div>}
                          {usableItems.map(item => (
                             <button 
                                key={item.id}
                                onClick={() => { onUseItem(item.id); setShowItems(false); }}
                                className="flex justify-between items-center p-2 hover:bg-slate-800 rounded text-left text-xs text-white border border-transparent hover:border-slate-600 w-full"
                             >
                                <span className="flex items-center gap-2">{item.icon} {item.name}</span>
                                <span className="font-mono text-slate-400">x{player.inventory[item.id]}</span>
                             </button>
                          ))}
                       </div>
                    )}
                </div>
             </div>
         </div>
      </div>

      {showProfile && <CharacterSheet player={player} shopItems={shopItems} onClose={() => setShowProfile(false)} onOpenInventory={() => { setShowProfile(false); setShowInventory(true); }} />}
      {showInventory && <InventoryScreen player={player} shopItems={shopItems} onClose={() => setShowInventory(false)} onEquip={onEquipItem} onUse={onUseItem} />}
    </div>
  );
};
