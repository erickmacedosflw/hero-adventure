import { Item, Player } from '../../types';
import { applyEquipmentBonusesToStats } from './equipmentBonuses';

export const buyItemForPlayer = (player: Player, item: Item, quantity = 1): Player => {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  if (player.level < item.minLevel) {
    return player;
  }
  const totalCost = item.cost * safeQuantity;
  if (player.gold < totalCost) {
    return player;
  }

  return {
    ...player,
    gold: player.gold - totalCost,
    inventory: {
      ...player.inventory,
      [item.id]: (player.inventory[item.id] || 0) + safeQuantity,
    },
  };
};

export const sellItemFromPlayer = (player: Player, item: Item, quantity = 1): Player => {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const qty = player.inventory[item.id] || 0;
  if (qty <= 0 || safeQuantity > qty) {
    return player;
  }

  const sellPrice = Math.floor(item.cost / 2);
  return {
    ...player,
    gold: player.gold + (sellPrice * safeQuantity),
    inventory: {
      ...player.inventory,
      [item.id]: qty - safeQuantity,
    },
  };
};

export const equipItemOnPlayer = (player: Player, item: Item): Player => {
  const normalizedInventory = { ...player.inventory };
  const ensureEquippedVisible = (equipped: Item | null) => {
    if (!equipped) return;
    if ((normalizedInventory[equipped.id] || 0) <= 0) {
      normalizedInventory[equipped.id] = 1;
    }
  };

  ensureEquippedVisible(player.equippedWeapon);
  ensureEquippedVisible(player.equippedArmor);
  ensureEquippedVisible(player.equippedHelmet);
  ensureEquippedVisible(player.equippedLegs);
  ensureEquippedVisible(player.equippedShield);

  const qty = normalizedInventory[item.id] || 0;
  if (qty <= 0) {
    return player;
  }

  let newStats = { ...player.stats };

  let newWep = player.equippedWeapon;
  let newArm = player.equippedArmor;
  let newHelm = player.equippedHelmet;
  let newLegs = player.equippedLegs;
  let newShield = player.equippedShield;

  if (item.type === 'weapon') {
    newStats = applyEquipmentBonusesToStats(newStats, newWep, -1);
    newStats = applyEquipmentBonusesToStats(newStats, item, 1);
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
    ...player,
    stats: newStats,
    inventory: normalizedInventory,
    equippedWeapon: newWep,
    equippedArmor: newArm,
    equippedHelmet: newHelm,
    equippedLegs: newLegs,
    equippedShield: newShield,
  };
};

type ConsumableKind = 'heal' | 'mana' | 'atk_buff' | 'def_buff' | 'none';

export interface ConsumableEffect {
  kind: ConsumableKind;
  amount: number;
}

export const useConsumable = (player: Player, item: Item): { player: Player; effect: ConsumableEffect } => {
  const qty = player.inventory[item.id] || 0;
  if (item.type !== 'potion' || qty <= 0) {
    return { player, effect: { kind: 'none', amount: 0 } };
  }

  const newInventory = { ...player.inventory, [item.id]: qty - 1 };
  let nextPlayer: Player = { ...player, inventory: newInventory };
  let effect: ConsumableEffect = { kind: 'none', amount: 0 };

  if (item.id === 'pot_1' || item.id === 'pot_3' || item.id === 'pot_4') {
    const healed = Math.min(item.value, player.stats.maxHp - player.stats.hp);
    nextPlayer = {
      ...nextPlayer,
      stats: { ...nextPlayer.stats, hp: Math.min(nextPlayer.stats.maxHp, nextPlayer.stats.hp + item.value) },
    };
    effect = { kind: 'heal', amount: healed };
  } else if (item.id === 'pot_2') {
    const restored = Math.min(item.value, player.stats.maxMp - player.stats.mp);
    nextPlayer = {
      ...nextPlayer,
      stats: { ...nextPlayer.stats, mp: Math.min(nextPlayer.stats.maxMp, nextPlayer.stats.mp + item.value) },
    };
    effect = { kind: 'mana', amount: restored };
  } else if (item.id === 'pot_atk') {
    nextPlayer = {
      ...nextPlayer,
      buffs: {
        ...nextPlayer.buffs,
        atkMod: item.value,
        atkTurns: item.duration || 3,
      },
    };
    effect = { kind: 'atk_buff', amount: item.duration || 3 };
  } else if (item.id === 'pot_def') {
    nextPlayer = {
      ...nextPlayer,
      buffs: {
        ...nextPlayer.buffs,
        defMod: item.value,
        defTurns: item.duration || 3,
      },
    };
    effect = { kind: 'def_buff', amount: item.duration || 3 };
  }

  return { player: nextPlayer, effect };
};
