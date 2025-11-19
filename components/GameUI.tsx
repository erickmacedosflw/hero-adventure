import React, { useState } from 'react';
import { Player, Enemy, BattleLog, TurnState, Item, Skill, GameState, Stats, FloatingText } from '../types';
import { Sword, Shield, Zap, Heart, Coins, ShoppingBag, Skull, Play, Plus, FlaskConical, User, X, Home, LogOut, DollarSign, ArrowLeft, AlertTriangle } from 'lucide-react';
import { ItemPreviewCanvas } from './Scene3D';

interface GameUIProps {
  player: Player;
  enemy: Enemy | null;
  gameState: GameState;
  turnState: TurnState;
  logs: BattleLog[];
  onAttack: () => void;
  onSkill: (skill: Skill) => void;
  onUseItem: (itemId: string) => void;
  onStartBattle: (isBoss: boolean) => void;
  onEnterShop: () => void;
  onBuyItem: (item: Item) => void;
  onSellItem: (item: Item) => void;
  onDistributeStat: (stat: keyof Stats) => void;
  onContinue: () => void; // Used for Level Up or Victory -> Tavern
  onFlee: () => void;
  currentNarration: string;
  shopItems: Item[];
  floatingTexts?: FloatingText[];
  stage: number;
  killCount: number;
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
                
                let colorClass = "text-white";
                if (t.type === 'damage') colorClass = "text-red-500";
                if (t.type === 'heal') colorClass = "text-green-400";
                if (isCrit) colorClass = "text-amber-400";

                return (
                    <div 
                        key={t.id}
                        className={`absolute font-black ${colorClass} drop-shadow-[0_2px_2px_rgba(0,0,0,1)] flex items-center justify-center`}
                        style={{
                            left: `calc(${leftPos} + ${t.xOffset}px)`,
                            top: `calc(${topPos} + ${t.yOffset}px)`,
                            fontSize: isCrit ? '3rem' : '2rem',
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
const CharacterSheet = ({ player, shopItems, onClose }: { player: Player, shopItems: Item[], onClose: () => void }) => {
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

           {/* Middle: Equipment with 3D Preview */}
           <div>
              <h3 className="font-bold text-indigo-400 mb-3 border-b border-slate-700 pb-1 flex items-center gap-2"><Shield size={16}/> Equipamento</h3>
              <div className="space-y-2">
                 {slots.map((slot, idx) => (
                     <div key={idx} className="bg-slate-800 p-2 rounded-lg flex items-center gap-3 border border-slate-700 relative overflow-hidden h-16">
                        {/* 3D Preview Container */}
                        <div className="w-12 h-12 bg-slate-900 rounded border border-slate-700 relative shrink-0">
                             {slot.item ? (
                                 <ItemPreviewCanvas itemType={slot.item.type} itemId={slot.item.id} />
                             ) : (
                                 <div className="absolute inset-0 flex items-center justify-center text-slate-700 text-xl">{slot.icon}</div>
                             )}
                        </div>

                        <div className="flex-1 z-10">
                           <div className="text-[9px] uppercase tracking-wider text-slate-500">{slot.label}</div>
                           <div className="font-bold text-white text-sm truncate">{slot.item?.name || "Vazio"}</div>
                           {slot.item && <div className="text-[10px] text-indigo-300">+{slot.item.value} {slot.item.type === 'weapon' ? 'ATK' : 'DEF'}</div>}
                        </div>
                     </div>
                 ))}
              </div>
           </div>

           {/* Right: Inventory */}
           <div>
              <h3 className="font-bold text-emerald-400 mb-3 border-b border-slate-700 pb-1 flex items-center gap-2"><ShoppingBag size={16}/> Inventário</h3>
               <div className="space-y-2 h-64 overflow-y-auto pr-2">
                  {Object.entries(player.inventory).map(([id, qty]) => {
                      if(qty <= 0) return null;
                      const itemDef = shopItems.find(i => i.id === id);
                      if (!itemDef) return null;

                      return (
                        <div key={id} className="flex justify-between items-center bg-slate-800 p-2 rounded text-sm border border-slate-700">
                           <div className="flex items-center gap-3">
                               <span className="text-xl">{itemDef.icon}</span>
                               <div>
                                   <div className="font-bold text-slate-200">{itemDef.name}</div>
                                   <div className="text-[10px] text-slate-500">{itemDef.type === 'potion' ? 'Consumível' : 'Item'}</div>
                               </div>
                           </div>
                           <span className="bg-black/40 px-2 py-1 rounded text-white font-mono font-bold">x{qty}</span>
                        </div>
                      )
                  })}
                   {Object.values(player.inventory).every(q => q <= 0) && (
                       <div className="text-center p-8 text-slate-600 italic border border-dashed border-slate-700 rounded-lg">
                           Mochila vazia.
                       </div>
                   )}
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
  shopItems: Item[]
}> = ({ player, stage, killCount, onHunt, onBoss, onShop, shopItems }) => {
  const [showProfile, setShowProfile] = useState(false);
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
    {showProfile && <CharacterSheet player={player} shopItems={shopItems} onClose={() => setShowProfile(false)} />}
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

export const ShopScreen: React.FC<{ player: Player, items: Item[], onBuy: (i: Item) => void, onSell: (i: Item) => void, onLeave: () => void }> = ({ player, items, onBuy, onSell, onLeave }) => (
  <div className="absolute inset-0 z-40 bg-slate-950 text-white flex flex-col pointer-events-auto">
    <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-lg z-10">
      <div className="flex items-center gap-3">
        <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500"><ShoppingBag /></div>
        <div>
           <h2 className="font-bold text-xl text-amber-100">Mercador do Vazio</h2>
           <p className="text-xs text-slate-500">Equipamentos antigos substituídos vão para seu inventário para venda.</p>
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

    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT: SHOP ITEMS */}
        <div className="flex-1 overflow-y-auto p-4 border-r border-slate-800">
            <h3 className="font-bold text-indigo-400 mb-4 flex items-center gap-2"><ShoppingBag size={18}/> ITENS A VENDA</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => {
                    const canAfford = player.gold >= item.cost;
                    const isEquipped = 
                        (player.equippedWeapon?.id === item.id) || 
                        (player.equippedArmor?.id === item.id) ||
                        (player.equippedHelmet?.id === item.id) ||
                        (player.equippedLegs?.id === item.id) ||
                        (player.equippedShield?.id === item.id);
                    
                    return (
                    <div key={item.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col hover:border-slate-600 transition-all group relative">
                        <div className="h-24 w-full bg-slate-950/50 rounded-lg mb-2 relative border border-slate-800 overflow-hidden">
                            <ItemPreviewCanvas itemType={item.type} itemId={item.id} />
                        </div>
                        <div className="flex justify-between items-start mb-1">
                            <div className="font-bold text-sm">{item.name}</div>
                            <span className="font-mono text-amber-400 text-xs">{item.cost} G</span>
                        </div>
                        <div className="text-xs text-slate-500 mb-2 h-8 overflow-hidden">{item.description}</div>
                        <button 
                            onClick={() => canAfford && !isEquipped && onBuy(item)}
                            disabled={!canAfford || isEquipped}
                            className={`py-2 rounded font-bold text-xs transition-colors
                                ${isEquipped ? 'bg-slate-800 text-slate-500 cursor-default' : 
                                canAfford ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 text-slate-600'}
                            `}
                        >
                            {isEquipped ? 'POSSUÍDO' : canAfford ? 'COMPRAR' : 'FALTA OURO'}
                        </button>
                    </div>
                    )
                })}
            </div>
        </div>

        {/* RIGHT: PLAYER INVENTORY (SELL) */}
        <div className="w-full md:w-80 bg-slate-900 p-4 overflow-y-auto">
            <h3 className="font-bold text-emerald-400 mb-4 flex items-center gap-2"><DollarSign size={18}/> VENDER ITENS</h3>
            <p className="text-xs text-slate-500 mb-4">Clique em um item para vendê-lo por 50% do valor.</p>
            <div className="space-y-2">
                {Object.entries(player.inventory).map(([id, qty]) => {
                    if(qty <= 0) return null;
                    const itemDef = items.find(i => i.id === id);
                    if (!itemDef) return null;
                    const sellPrice = Math.floor(itemDef.cost / 2);

                    return (
                        <button 
                            key={id} 
                            onClick={() => onSell(itemDef)}
                            className="w-full flex justify-between items-center bg-slate-800 hover:bg-red-900/30 hover:border-red-500 p-2 rounded text-sm border border-slate-700 transition-all group"
                        >
                            <div className="flex items-center gap-3 text-left">
                                <span className="text-xl">{itemDef.icon}</span>
                                <div>
                                    <div className="font-bold text-slate-200 group-hover:text-white">{itemDef.name}</div>
                                    <div className="text-[10px] text-slate-500 group-hover:text-red-300">Vender por: <span className="text-amber-400">{sellPrice} G</span></div>
                                </div>
                            </div>
                            <span className="bg-black/40 px-2 py-1 rounded text-white font-mono font-bold">x{qty}</span>
                        </button>
                    )
                })}
                {Object.values(player.inventory).every(q => q <= 0) && (
                    <div className="text-center p-8 text-slate-600 italic border border-dashed border-slate-700 rounded-lg">
                        Nada para vender.
                    </div>
                )}
            </div>
        </div>
    </div>
  </div>
);

export const BattleHUD: React.FC<GameUIProps> = (props) => {
  const { player, enemy, turnState, logs, onAttack, onSkill, onUseItem, currentNarration, gameState, shopItems, floatingTexts, onFlee, stage, killCount } = props;
  const [showItems, setShowItems] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
      <div className="absolute top-1/4 right-4 w-64 flex flex-col gap-1 pointer-events-none items-end">
         {logs.slice(0, 5).map((log, i) => (
            <div key={i} className={`px-3 py-1 rounded text-xs md:text-sm font-bold shadow-sm animate-fade-in-left border-r-4 text-right
               ${log.type === 'damage' ? 'bg-red-900/80 border-red-500 text-white' : 
                 log.type === 'heal' ? 'bg-green-900/80 border-green-500 text-white' : 
                 log.type === 'crit' ? 'bg-amber-600/80 border-yellow-300 text-white' : 'bg-slate-800/80 border-slate-500 text-slate-200'}
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
                        <div className="text-sm text-slate-400">HERÓI</div>
                        <div className="text-2xl font-black text-indigo-400">{player.name}</div>
                     </div>
                     {/* PROFILE BUTTON IN HUD */}
                     <button 
                        onClick={() => setShowProfile(true)}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-1.5 rounded-lg transition-colors"
                        title="Ver Perfil"
                     >
                         <User size={18} />
                     </button>
                 </div>
                 
                 <div className="mb-1">
                    <div className="flex justify-between text-[10px] font-bold mb-0.5"><span className="text-green-400">VIDA</span> <span>{player.stats.hp}/{player.stats.maxHp}</span></div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width: `${(player.stats.hp/player.stats.maxHp)*100}%`}}></div></div>
                 </div>
                 <div className="mb-2">
                    <div className="flex justify-between text-[10px] font-bold mb-0.5"><span className="text-blue-400">MANA</span> <span>{player.stats.mp}/{player.stats.maxMp}</span></div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${(player.stats.mp/player.stats.maxMp)*100}%`}}></div></div>
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
             <div className="flex-1 w-full grid grid-cols-4 gap-2 h-28">
                
                <button 
                   onClick={onAttack} 
                   disabled={!isPlayerTurn}
                   className={`col-span-1 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 transition-all active:translate-y-1 active:border-b-0
                      ${isPlayerTurn ? 'bg-red-600 border-red-800 text-white hover:bg-red-500 shadow-lg shadow-red-900/20' : 'bg-slate-800 border-slate-900 text-slate-600'}
                   `}
                >
                   <Sword size={24} />
                   <span className="font-black text-xs md:text-sm">ATACAR</span>
                </button>

                <div className="col-span-2 grid grid-cols-2 gap-2 relative">
                   {player.skills.map(skill => {
                      const canCast = player.stats.mp >= skill.manaCost;
                      return (
                        <button 
                            key={skill.id}
                            onClick={() => onSkill(skill)}
                            disabled={!isPlayerTurn || !canCast}
                            className={`rounded-lg p-1 border flex flex-col justify-center items-center transition-all text-xs
                                ${!isPlayerTurn ? 'bg-slate-900 border-slate-800 text-slate-600' : 
                                  canCast ? 'bg-indigo-900/90 border-indigo-500 text-indigo-200 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-50'}
                            `}
                        >
                            <span className="font-bold truncate w-full text-center">{skill.name}</span>
                            <span className="font-mono text-[10px] opacity-70">{skill.manaCost} MP</span>
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

      {showProfile && <CharacterSheet player={player} shopItems={shopItems} onClose={() => setShowProfile(false)} />}
    </div>
  );
};