
import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Play } from 'lucide-react';
import { GameScene } from './components/Scene3D';
import { BattleHUD, MenuScreen, ShopScreen, LevelUpScreen, TavernScreen } from './components/GameUI';
import { 
  Player, Enemy, GameState, TurnState, BattleLog, Item, Skill, Stats, Particle, FloatingText
} from './types';
import { 
  INITIAL_PLAYER, SHOP_ITEMS, ALL_ITEMS, MATERIALS, SKILLS, ENEMY_DATA, ENEMY_COLORS 
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
  const [isPlayerHit, setIsPlayerHit] = useState(false);
  const [isEnemyHit, setIsEnemyHit] = useState(false);
  const [screenShake, setScreenShake] = useState(0);
  const [isLevelingUp, setIsLevelingUp] = useState(false);

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
      isBoss,
      isDefending: false
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

      setEnemy(prev => {
        if (!prev) return null;
        return { ...prev, stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) } };
      });

      setPlayer(prev => ({ ...prev, limitMeter: 0 }));

      setTimeout(() => {
        setTurnState(TurnState.ENEMY_TURN);
      }, 1000);
    }, 800);
  };

  const handleFlee = () => {
      // Calculate cost
      const cost = 50;
      const lostGold = Math.min(player.gold, cost);
      
      setPlayer(prev => ({
          ...prev,
          gold: prev.gold - lostGold,
          buffs: { atkMod: 0, defMod: 0, atkTurns: 0, defTurns: 0 } // Reset buffs on flee
      }));

      addLog(`Fugiu! Perdeu ${lostGold} Ouro.`, "info");
      setGameState(GameState.TAVERN);
      setEnemy(null);
  }

  const calculateDamage = (attackerAtk: number, defenderDef: number, multiplier: number = 1, luck: number = 0, isPlayerAttacking: boolean = false) => {
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

    const base = Math.max(1, finalAtk - (finalDef * 0.3)); 
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

    const { damage, isCrit } = calculateDamage(player.stats.atk, enemy.stats.def, 1, player.stats.luck, true);
    
    // Apply enemy defense
    const finalDamage = enemy.isDefending ? Math.floor(damage * 0.5) : damage;

    setTimeout(() => {
      setIsPlayerAttacking(false);
      
      // VFX
      spawnParticles([2, -0.5, 0], 10, isCrit ? '#fbbf24' : '#ffffff', 'explode');
      spawnFloatingText(isCrit ? `CRIT! ${finalDamage}` : finalDamage, 'enemy', isCrit ? 'crit' : 'damage');
      setScreenShake(isCrit ? 0.5 : 0.2);
      setIsEnemyHit(true);
      setTimeout(() => {
          setScreenShake(0);
          setIsEnemyHit(false);
      }, 200);
      
      setEnemy(prev => {
        if (!prev) return null;
        return { 
          ...prev, 
          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) },
          isDefending: false // Reset defense after being hit
        };
      });

      addLog(`Causou ${finalDamage} dano!${enemy.isDefending ? ' (Defendido)' : ''}`, isCrit ? 'crit' : 'damage');

      if ((enemy.stats.hp - finalDamage) <= 0) handleVictory();
      else setTimeout(() => setTurnState(TurnState.ENEMY_TURN), 600);
    }, 400);
  };

  const handlePlayerDefense = () => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT) return;

    setPlayer(prev => ({ ...prev, isDefending: true }));
    addLog("Você se preparou para defender!", "buff");
    spawnFloatingText("DEFESA!", "player", "buff");
    spawnParticles([-2, -1, 0], 10, "#3b82f6", "spark");

    setTimeout(() => setTurnState(TurnState.ENEMY_TURN), 600);
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
              const { damage, isCrit } = calculateDamage(player.stats.atk, enemy.stats.def, skill.damageMult, player.stats.luck, true);
              
              // Apply enemy defense
              const finalDamage = enemy.isDefending ? Math.floor(damage * 0.5) : damage;

              // Magic VFX
              const color = skill.type === 'magic' ? '#ef4444' : '#a855f7';
              spawnParticles([2, -0.5, 0], 20, color, 'explode');
              spawnFloatingText(isCrit ? `CRIT! ${finalDamage}` : finalDamage, 'enemy', isCrit ? 'crit' : 'damage');
              setScreenShake(isCrit ? 0.6 : 0.3);
              setTimeout(() => setScreenShake(0), 200);

              setEnemy(prev => {
                if (!prev) return null;
                return { 
                  ...prev, 
                  stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) },
                  isDefending: false // Reset defense after being hit
                };
              });
              addLog(`${skill.name}: ${finalDamage} dano!${enemy.isDefending ? ' (Defendido)' : ''}`, isCrit ? 'crit' : 'damage');
              
              if ((enemy.stats.hp - finalDamage) <= 0) handleVictory();
              else setTimeout(() => setTurnState(TurnState.ENEMY_TURN), 800);
          }, 500);
      }
  };

  const handleUseItem = (itemId: string) => {
      if (turnState !== TurnState.PLAYER_INPUT) return;

      const item = ALL_ITEMS.find(i => i.id === itemId);
      const qty = player.inventory[itemId] || 0;
      if (!item || qty <= 0) return;

      setPlayer(p => {
          const currentQty = p.inventory[itemId] || 0;
          if (currentQty <= 0) return p;

          const newInv = { ...p.inventory };
          newInv[itemId] = currentQty - 1;
          let newHp = p.stats.hp;
          let newMp = p.stats.mp;
          let newBuffs = { ...p.buffs };

          // Healing Logic
          if (item.name.includes("Vida") || item.name.includes("Elixir") || item.name.includes("Ambrosia") || item.name.includes("Menor")) {
             const healVal = item.value;
             newHp = Math.min(p.stats.maxHp, p.stats.hp + healVal);
             spawnParticles([-2, -1, 0], 10, '#4ade80', 'heal'); 
             spawnFloatingText(`+${healVal}`, 'player', 'heal');
             addLog(`Usou ${item.name}, recuperou ${item.value} HP`, 'heal');
          }
          // Mana Logic
          else if (item.name.includes("Mana")) {
             const manaVal = item.value;
             newMp = Math.min(p.stats.maxMp, p.stats.mp + manaVal);
             spawnParticles([-2, -1, 0], 10, '#3b82f6', 'heal');
             spawnFloatingText(`+${manaVal} MP`, 'player', 'heal');
             addLog(`Usou ${item.name}, recuperou ${item.value} MP`, 'heal');
          }
          // Buff Logic (Attack)
          else if (item.id === 'pot_atk') {
              newBuffs.atkMod = item.value;
              newBuffs.atkTurns = item.duration || 3;
              spawnParticles([-2, -1, 0], 15, '#f97316', 'spark');
              spawnFloatingText(`ATAQUE UP!`, 'player', 'buff');
              addLog(`Usou ${item.name}! Dano aumentado por ${item.duration} turnos.`, 'buff');
          }
          // Buff Logic (Defense)
          else if (item.id === 'pot_def') {
              newBuffs.defMod = item.value;
              newBuffs.defTurns = item.duration || 3;
              spawnParticles([-2, -1, 0], 15, '#10b981', 'spark');
              spawnFloatingText(`DEFESA UP!`, 'player', 'buff');
              addLog(`Usou ${item.name}! Defesa aumentada por ${item.duration} turnos.`, 'buff');
          }

          return { ...p, inventory: newInv, stats: { ...p.stats, hp: newHp, mp: newMp }, buffs: newBuffs };
      });
      if (gameState === GameState.BATTLE) {
          setTurnState(TurnState.ENEMY_TURN);
      }
  };

  const handleEnemyTurn = () => {
    if (!enemy || gameState !== GameState.BATTLE) return;
    
    setIsEnemyAttacking(true);
    
    // Enemy AI: Chance to defend instead of attack
    const shouldDefend = Math.random() < 0.2;

    setTimeout(() => {
      setIsEnemyAttacking(false);

      // Reset enemy defense at start of their turn
      setEnemy(prev => prev ? ({ ...prev, isDefending: false }) : null);

      if (shouldDefend) {
        setEnemy(prev => prev ? ({ ...prev, isDefending: true }) : null);
        addLog(`${enemy.name} está se defendendo!`, "buff");
        spawnFloatingText("DEFESA!", "enemy", "buff");
        spawnParticles([2, -0.5, 0], 10, "#3b82f6", "spark");
        
        // Reset player defense at start of their turn
        setPlayer(p => ({ ...p, isDefending: false }));
        setTurnState(TurnState.PLAYER_INPUT);
        return;
      }

      const { damage } = calculateDamage(enemy.stats.atk, player.stats.def, 1, 0, false);
      
      // Apply player defense
      const finalDamage = player.isDefending ? Math.floor(damage * 0.5) : damage;

      spawnParticles([-2, -1, 0], 5, '#dc2626', 'spark');
      spawnFloatingText(finalDamage, 'player', 'damage');
      setScreenShake(0.2);
      setIsPlayerHit(true);
      setTimeout(() => {
          setScreenShake(0);
          setIsPlayerHit(false);
      }, 200);
      
      setPlayer(prev => {
          // Decrement buffs at end of enemy turn (start of player turn)
          const nextBuffs = { ...prev.buffs };
          if (nextBuffs.atkTurns > 0) nextBuffs.atkTurns--;
          if (nextBuffs.defTurns > 0) nextBuffs.defTurns--;

          return {
            ...prev,
            buffs: nextBuffs,
            isDefending: false, // Reset defense after being hit
            stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) }
          }
      });

      addLog(`${enemy.name} atacou: ${finalDamage} dano!${player.isDefending ? ' (Defendido)' : ''}`, 'damage');

      if ((player.stats.hp - finalDamage) <= 0) {
         if (enemy.isBoss) {
             // Boss loss = Back to Tavern, no game over, no progression
             setGameState(GameState.TAVERN);
             setPlayer(p => ({ ...p, stats: { ...p.stats, hp: 1 }, buffs: { atkMod:0, defMod:0, atkTurns:0, defTurns:0 }, isDefending: false })); 
             addLog("Derrotado pelo Chefão. Recuou para Taverna.", "info");
         } else {
             // Normal mob loss = Game Over
             setGameState(GameState.GAME_OVER);
         }
      } else {
         // Reset player defense at start of their turn
         setPlayer(p => ({ ...p, isDefending: false }));
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
     const wasBoss = enemy.isBoss;
     
     // Generate Drops
     const drops: string[] = [];
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
         buffs: { atkMod: 0, defMod: 0, atkTurns: 0, defTurns: 0 } // Reset buffs on victory
     };

     // Update Stage Logic
     let leveledUp = false;
     if (wasBoss) {
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
     
     let dropText = drops.length > 0 
        ? ` Drops: ${drops.map(d => ALL_ITEMS.find(i => i.id === d)?.name).join(', ')}` 
        : '';
     addLog(`Vitória! +${xpGain} XP, +${goldGain} Ouro.${dropText}`, 'crit');

     // Logic for Auto Battle / Level Up Interruption
     setEnemy(null); // Clear enemy model immediately
     
     if (leveledUp) {
         setGameState(GameState.LEVEL_UP);
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

  const handleLevelUpContinue = () => {
      // Always go to Tavern after level up to allow player to rest and manage stats/items
      setGameState(GameState.TAVERN);
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
      if (player.gold >= item.cost && player.level >= item.minLevel) {
          setPlayer(p => {
              const newGold = p.gold - item.cost;
              const newInv = { ...p.inventory };

              newInv[item.id] = (newInv[item.id] || 0) + 1;
              return { ...p, gold: newGold, inventory: newInv };
          });
      }
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
        isPlayerDefending={player.isDefending}
        isEnemyDefending={enemy?.isDefending}
        isPlayerHit={isPlayerHit}
        isEnemyHit={isEnemyHit}
        screenShake={screenShake}
        isLevelingUp={isLevelingUp}
        stage={stage}
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
            shopItems={ALL_ITEMS}
            onEquipItem={equipItem}
            onUseItem={handleUseItem}
          />
      )}

      {gameState === GameState.LEVEL_UP && (
          <LevelUpScreen 
            player={player} 
            onDistribute={handleStatDistribution} 
            onContinue={handleLevelUpContinue}
          />
      )}

      {gameState === GameState.SHOP && (
        <ShopScreen 
            player={player} 
            items={ALL_ITEMS} 
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
            onDefend={handlePlayerDefense}
            onSkill={handleSkill}
            onUseItem={handleUseItem}
            onStartBattle={() => enterBattle(false)} // Logic handled by victory screen usually
            onEnterShop={() => {}} // Disabled in battle
            onBuyItem={buyItem}
            onSellItem={sellItem}
            onEquipItem={equipItem}
            onDistributeStat={() => {}}
            onContinue={() => {}}
            onFlee={handleFlee}
            currentNarration={narration}
            shopItems={ALL_ITEMS}
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
