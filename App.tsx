import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Play } from 'lucide-react';
import { GameScene } from './components/Scene3D';
import { BattleHUD, MenuScreen, ShopScreen, LevelUpScreen, TavernScreen } from './components/GameUI';
import { 
  Player, Enemy, GameState, TurnState, BattleLog, Item, Skill, Stats, Particle, FloatingText
} from './types';
import { 
  INITIAL_PLAYER, SHOP_ITEMS, SKILLS, ENEMY_DATA, ENEMY_COLORS 
} from './constants';
import { generateBattleDescription, generateVictorySpeech } from './services/geminiService';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [turnState, setTurnState] = useState<TurnState>(TurnState.PLAYER_INPUT);
  const [player, setPlayer] = useState<Player>(INITIAL_PLAYER);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [narration, setNarration] = useState<string>("");
  
  const [stage, setStage] = useState(1);
  const [killCount, setKillCount] = useState(0); // Track kills in current stage

  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);

  // Animation States
  const [isPlayerAttacking, setIsPlayerAttacking] = useState(false);
  const [isEnemyAttacking, setIsEnemyAttacking] = useState(false);

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

  const spawnFloatingText = (value: string | number, target: 'player' | 'enemy', type: 'damage' | 'heal' | 'crit') => {
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

  // --- LOGIC ---

  const addLog = (message: string, type: BattleLog['type'] = 'info') => {
    setLogs(prev => [{ message, type }, ...prev]);
  };

  const spawnEnemy = async (currentStage: number, isBoss: boolean) => {
    // Scale stats based on stage
    let levelMult = 1 + (currentStage * 0.15);
    if (isBoss) levelMult *= 2.0; // Boss is significantly stronger

    const enemyTemplate = ENEMY_DATA[Math.floor(Math.random() * ENEMY_DATA.length)];
    const color = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
    
    const name = isBoss ? `General ${enemyTemplate.name}` : enemyTemplate.name;

    const newEnemy: Enemy = {
      id: `enemy_${Date.now()}`,
      name: name,
      level: currentStage,
      stats: {
        hp: Math.floor(60 * levelMult),
        maxHp: Math.floor(60 * levelMult),
        mp: 0, maxMp: 0,
        atk: Math.floor(8 * levelMult),
        def: Math.floor(2 * levelMult),
        speed: 10,
        luck: 0
      },
      xpReward: Math.floor(40 * levelMult * (isBoss ? 3 : 1)),
      goldReward: Math.floor(25 * levelMult * (isBoss ? 3 : 1)),
      color: isBoss ? '#ef4444' : color, // Boss is red-tinted default or custom
      scale: (0.8 + (Math.random() * 0.4)) * (isBoss ? 2.0 : 1.0), // Boss is Huge
      type: enemyTemplate.type as 'beast' | 'humanoid' | 'undead',
      isBoss
    };

    setEnemy(newEnemy);
    setNarration(isBoss ? `O CHEFÃO DA FASE ${currentStage} RUGIU!` : "Um inimigo se aproxima...");
    
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
    setPlayer(INITIAL_PLAYER);
    setLogs([]);
    setGameState(GameState.TAVERN);
  };

  const enterBattle = (isBoss: boolean) => {
      setGameState(GameState.BATTLE);
      setTurnState(TurnState.PLAYER_INPUT);
      setEnemy(null);
      setLogs([]);
      spawnEnemy(stage, isBoss);
  }

  const handleFlee = () => {
      // Calculate cost
      const cost = 50;
      const lostGold = Math.min(player.gold, cost);
      
      setPlayer(prev => ({
          ...prev,
          gold: prev.gold - lostGold
      }));

      addLog(`Fugiu! Perdeu ${lostGold} Ouro.`, "info");
      setGameState(GameState.TAVERN);
      setEnemy(null);
  }

  const calculateDamage = (attackerAtk: number, defenderDef: number, multiplier: number = 1, luck: number = 0) => {
    const base = Math.max(1, attackerAtk - (defenderDef * 0.3)); 
    const variance = Math.random() * 0.2 + 0.9; 
    
    // Crit calculation
    const critChance = luck * 0.02; // 2% per luck point
    const isCrit = Math.random() < (0.05 + critChance);
    const critMult = isCrit ? 1.5 : 1;

    return { 
      damage: Math.floor(base * multiplier * variance * critMult), 
      isCrit 
    };
  };

  const handlePlayerAttack = () => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT) return;

    setTurnState(TurnState.PLAYER_ANIMATION);
    setIsPlayerAttacking(true);

    setTimeout(() => {
      setIsPlayerAttacking(false);
      const { damage, isCrit } = calculateDamage(player.stats.atk, enemy.stats.def, 1, player.stats.luck);
      
      // VFX
      spawnParticles([2, -0.5, 0], 10, isCrit ? '#fbbf24' : '#ffffff', 'explode');
      spawnFloatingText(isCrit ? `CRIT! ${damage}` : damage, 'enemy', isCrit ? 'crit' : 'damage');
      
      setEnemy(prev => {
        if (!prev) return null;
        return { ...prev, stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - damage) } };
      });

      addLog(`Causou ${damage} dano!`, isCrit ? 'crit' : 'damage');

      if ((enemy.stats.hp - damage) <= 0) handleVictory();
      else setTimeout(() => setTurnState(TurnState.ENEMY_TURN), 600);
    }, 400);
  };

  const handleSkill = (skill: Skill) => {
      if (!enemy || turnState !== TurnState.PLAYER_INPUT || player.stats.mp < skill.manaCost) return;
      
      setTurnState(TurnState.PLAYER_ANIMATION);
      setPlayer(p => ({ ...p, stats: { ...p.stats, mp: p.stats.mp - skill.manaCost } }));
      
      if (skill.type === 'heal') {
          const healAmount = Math.floor(player.stats.maxHp * 0.4);
          setPlayer(p => ({ ...p, stats: { ...p.stats, hp: Math.min(p.stats.maxHp, p.stats.hp + healAmount) }}));
          
          spawnParticles([-2, -1, 0], 15, '#4ade80', 'heal');
          spawnFloatingText(`+${healAmount}`, 'player', 'heal');
          addLog(`Curou ${healAmount} HP!`, 'heal');
          
          setTimeout(() => setTurnState(TurnState.ENEMY_TURN), 800);
      } else {
          setIsPlayerAttacking(true);
          setTimeout(() => {
              setIsPlayerAttacking(false);
              const { damage, isCrit } = calculateDamage(player.stats.atk, enemy.stats.def, skill.damageMult, player.stats.luck);
              
              // Magic VFX
              const color = skill.type === 'magic' ? '#ef4444' : '#a855f7';
              spawnParticles([2, -0.5, 0], 20, color, 'explode');
              spawnFloatingText(isCrit ? `CRIT! ${damage}` : damage, 'enemy', isCrit ? 'crit' : 'damage');

              setEnemy(prev => prev ? ({ ...prev, stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - damage) } }) : null);
              addLog(`${skill.name}: ${damage} dano!`, isCrit ? 'crit' : 'damage');
              
              if ((enemy.stats.hp - damage) <= 0) handleVictory();
              else setTimeout(() => setTurnState(TurnState.ENEMY_TURN), 800);
          }, 500);
      }
  };

  const handleUseItem = (itemId: string) => {
      if (turnState !== TurnState.PLAYER_INPUT) return;

      const item = SHOP_ITEMS.find(i => i.id === itemId);
      const qty = player.inventory[itemId] || 0;

      if (item && qty > 0) {
          setPlayer(p => {
              const newInv = { ...p.inventory };
              newInv[itemId] = qty - 1;
              let newHp = p.stats.hp;
              let newMp = p.stats.mp;

              if (item.name.includes("Vida") || item.name.includes("Elixir")) {
                 const healVal = item.value;
                 newHp = Math.min(p.stats.maxHp, p.stats.hp + healVal);
                 spawnParticles([-2, -1, 0], 10, '#4ade80', 'heal'); 
                 spawnFloatingText(`+${healVal}`, 'player', 'heal');
                 addLog(`Usou ${item.name}, recuperou ${item.value} HP`, 'heal');
              }
              if (item.name.includes("Mana")) {
                 const manaVal = item.value;
                 newMp = Math.min(p.stats.maxMp, p.stats.mp + manaVal);
                 spawnParticles([-2, -1, 0], 10, '#3b82f6', 'heal');
                 spawnFloatingText(`+${manaVal} MP`, 'player', 'heal');
                 addLog(`Usou ${item.name}, recuperou ${item.value} MP`, 'heal');
              }

              return { ...p, inventory: newInv, stats: { ...p.stats, hp: newHp, mp: newMp } };
          });
          setTurnState(TurnState.ENEMY_TURN);
      }
  };

  const handleEnemyTurn = () => {
    if (!enemy || gameState !== GameState.BATTLE) return;
    
    setIsEnemyAttacking(true);
    setTimeout(() => {
      setIsEnemyAttacking(false);
      const { damage } = calculateDamage(enemy.stats.atk, player.stats.def);
      
      spawnParticles([-2, -1, 0], 5, '#dc2626', 'spark');
      spawnFloatingText(damage, 'player', 'damage');
      
      setPlayer(prev => ({
        ...prev,
        stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - damage) }
      }));

      addLog(`${enemy.name} atacou: ${damage} dano!`, 'damage');

      if ((player.stats.hp - damage) <= 0) {
         if (enemy.isBoss) {
             // Boss loss = Back to Tavern, no game over, no progression
             setGameState(GameState.TAVERN);
             setPlayer(p => ({ ...p, stats: { ...p.stats, hp: 1 } })); // Survive with 1 HP
             addLog("Derrotado pelo Chefão. Recuou para Taverna.", "info");
         } else {
             // Normal mob loss = Game Over
             setGameState(GameState.GAME_OVER);
         }
      } else {
         setTurnState(TurnState.PLAYER_INPUT);
      }
    }, 600);
  };

  useEffect(() => {
    if (turnState === TurnState.ENEMY_TURN && enemy && gameState === GameState.BATTLE) {
       handleEnemyTurn();
    }
  }, [turnState, enemy, gameState]);

  const handleVictory = async () => {
     if (!enemy) return;
     
     const xpGain = enemy.xpReward;
     const goldGain = enemy.goldReward;
     
     // Give rewards
     let updatedPlayer = {
         ...player,
         xp: player.xp + xpGain,
         gold: player.gold + goldGain
     };

     // Update Stage Logic
     let leveledUp = false;
     if (enemy.isBoss) {
         setStage(s => s + 1);
         setKillCount(0);
     } else {
         setKillCount(k => k + 1);
     }

     // Check Level Up logic
     if (updatedPlayer.xp >= updatedPlayer.xpToNext) {
         leveledUp = true;
         updatedPlayer.level += 1;
         updatedPlayer.xp -= updatedPlayer.xpToNext;
         updatedPlayer.xpToNext = Math.floor(updatedPlayer.xpToNext * 1.5);
         updatedPlayer.statPoints += 5; // 5 points to distribute
         updatedPlayer.stats.maxHp += 10; // Passive increase
         updatedPlayer.stats.hp = updatedPlayer.stats.maxHp; // Full heal
         updatedPlayer.stats.mp = updatedPlayer.stats.maxMp; // Full MP
         
         // Unlock skills based on level
         const newSkills = SKILLS.filter(s => s.minLevel <= updatedPlayer.level && !player.skills.find(ps => ps.id === s.id));
         updatedPlayer.skills = [...updatedPlayer.skills, ...newSkills];
     }

     setPlayer(updatedPlayer);
     addLog(`Vitória! +${xpGain} XP, +${goldGain} Ouro`, 'crit');

     try {
        const victoryText = await generateVictorySpeech(enemy.name);
        setNarration(victoryText);
     } catch(e) {}

     if (leveledUp) {
         setGameState(GameState.LEVEL_UP);
     } else {
         setGameState(GameState.VICTORY);
     }
  };

  const handleStatDistribution = (stat: keyof Stats) => {
     if (player.statPoints > 0) {
         setPlayer(p => ({
             ...p,
             statPoints: p.statPoints - 1,
             stats: { ...p.stats, [stat]: p.stats[stat] + 1 } // Add 1 to stat
         }));
     }
  };

  const buyItem = (item: Item) => {
      if (player.gold >= item.cost) {
          setPlayer(p => {
              const newGold = p.gold - item.cost;
              const newInv = { ...p.inventory };

              // Potions -> Inventory (Simple stack)
              if (item.type === 'potion') {
                  newInv[item.id] = (newInv[item.id] || 0) + 1;
                  return { ...p, gold: newGold, inventory: newInv };
              } 
              
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
                  gold: newGold, 
                  stats: newStats,
                  inventory: newInv,
                  equippedWeapon: newWep,
                  equippedArmor: newArm,
                  equippedHelmet: newHelm,
                  equippedLegs: newLegs,
                  equippedShield: newShield
              };
          });
      }
  };

  const sellItem = (item: Item) => {
      const sellPrice = Math.floor(item.cost / 2);
      const qty = player.inventory[item.id];

      if (qty && qty > 0) {
          setPlayer(p => {
              const newInv = { ...p.inventory };
              newInv[item.id] = qty - 1;
              return { ...p, gold: p.gold + sellPrice, inventory: newInv };
          });
      } 
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden font-sans select-none">
      <GameScene 
        enemyColor={enemy?.color || '#ff0000'} 
        enemyScale={enemy?.scale || 1}
        turnState={turnState}
        isPlayerAttacking={isPlayerAttacking}
        isEnemyAttacking={isEnemyAttacking}
        particles={particles}
        equippedWeaponId={player.equippedWeapon?.id}
        equippedArmorId={player.equippedArmor?.id}
        equippedHelmetId={player.equippedHelmet?.id}
        equippedLegsId={player.equippedLegs?.id}
        equippedShieldId={player.equippedShield?.id}
        enemyType={enemy?.type || 'beast'}
      />

      {gameState === GameState.MENU && <MenuScreen onStart={startGame} />}
      
      {gameState === GameState.TAVERN && (
          <TavernScreen 
            player={player}
            stage={stage}
            killCount={killCount}
            onHunt={() => enterBattle(false)}
            onBoss={() => enterBattle(true)}
            onShop={() => setGameState(GameState.SHOP)}
            shopItems={SHOP_ITEMS}
          />
      )}

      {gameState === GameState.LEVEL_UP && (
          <LevelUpScreen 
            player={player} 
            onDistribute={handleStatDistribution} 
            onContinue={() => setGameState(GameState.TAVERN)}
          />
      )}

      {gameState === GameState.SHOP && (
        <ShopScreen 
            player={player} 
            items={SHOP_ITEMS} 
            onBuy={buyItem} 
            onSell={sellItem}
            onLeave={() => setGameState(GameState.TAVERN)} 
        />
      )}

      {gameState === GameState.BATTLE && (
        <BattleHUD 
            player={player}
            enemy={enemy}
            gameState={gameState}
            turnState={turnState}
            logs={logs}
            onAttack={handlePlayerAttack}
            onSkill={handleSkill}
            onUseItem={handleUseItem}
            onStartBattle={() => enterBattle(false)} // Logic handled by victory screen usually
            onEnterShop={() => {}} // Disabled in battle
            onBuyItem={buyItem}
            onSellItem={sellItem}
            onDistributeStat={() => {}}
            onContinue={() => {}}
            onFlee={handleFlee}
            currentNarration={narration}
            shopItems={SHOP_ITEMS}
            floatingTexts={floatingTexts}
            stage={stage}
            killCount={killCount}
        />
      )}

      {gameState === GameState.VICTORY && (
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

      {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 z-50 bg-red-950/90 flex flex-col items-center justify-center text-white">
              <h1 className="text-6xl font-black mb-4 text-red-500 tracking-widest">GAME OVER</h1>
              <p className="text-2xl mb-8 opacity-70">Sua jornada terminou na Fase {stage}</p>
              <button onClick={startGame} className="px-10 py-4 bg-white text-red-900 font-black rounded hover:bg-gray-200 text-xl uppercase tracking-widest">
                  Renascer
              </button>
          </div>
      )}
    </div>
  );
}