import {
  ConsumableSlot,
  Enemy,
  Item,
  Player,
  RunCard,
  TowerFloorMap,
  TowerMeta,
  TowerNode,
  TowerNodeType,
  TowerRunRewards,
  TowerRunState,
  TowerSanctuaryOption,
} from '../../types';
import {
  DEFAULT_TOWER_META,
  TOWER_ACTS,
  TOWER_BOSS_FLOORS,
  TOWER_CONSUMABLE_MAX_STACK,
  TOWER_CONSUMABLE_SLOTS_BY_LEVEL,
  TOWER_DIFFICULTY_SCALE_PER_LOOP,
  TOWER_FLOORS_PER_ACT,
  TOWER_NODES_PER_FLOOR,
  TOWER_PATHS_PER_ACT,
} from '../../constants';
import {
  NODE_TYPE_WEIGHTS_BY_ACT,
  SANCTUARY_CARD_OPTIONS,
  SANCTUARY_HEAL_OPTIONS,
  SANCTUARY_VARIABLE_OPTIONS,
  TOWER_RUN_CARDS,
} from '../data/tower';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function pickWeighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = Math.random() * total;
  for (const [item, weight] of entries) {
    r -= weight;
    if (r <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── FLOOR PHASE HELPERS ─────────────────────────────────────────────────────

function getFloorPhase(floor: number): 'early' | 'mid' | 'late' {
  if (floor <= 3) return 'early';
  if (floor <= 10) return 'mid';
  return 'late';
}

function getNodeCountForFloor(floor: number): number {
  return TOWER_NODES_PER_FLOOR[getFloorPhase(floor)];
}

function getActForFloor(floor: number): number {
  return Math.min(Math.ceil(floor / TOWER_FLOORS_PER_ACT), TOWER_ACTS);
}

function isBossFloor(floor: number): boolean {
  return (TOWER_BOSS_FLOORS as readonly number[]).includes(floor);
}

// ─── FLOOR MAP GENERATION ────────────────────────────────────────────────────

/**
 * Generates a procedural floor map for the given floor + loop.
 *
 * Structure:
 *   - nodeColumns[0] = entry column (1 node, type depends on floor)
 *   - nodeColumns[1..N-2] = intermediate columns (2–3 rows each)
 *   - nodeColumns[N-1] = boss node (single node, type COMBAT/ELITE with boss flag)
 *
 * Connections are set so every node leads to at least one node in the next column,
 * and the graph has no backward edges.
 */
export function generateFloorMap(floor: number, loop: number = 0): TowerFloorMap {
  const act = getActForFloor(floor);
  const nodeCount = getNodeCountForFloor(floor);       // intermediate nodes total
  const pathWidth = TOWER_PATHS_PER_ACT[act] ?? 2;    // max parallel branches
  const weights = NODE_TYPE_WEIGHTS_BY_ACT[act] ?? NODE_TYPE_WEIGHTS_BY_ACT[1];

  // Build intermediate columns (between entry and boss)
  // Each column has 2–pathWidth nodes
  const numColumns = 3; // entry(1) + middle(1) + boss(1) — fixed 3-column structure for clarity
  const nodeColumns: TowerNode[][] = [];

  // Column 0: entry (single node, COMBAT or EVENT based on floor parity)
  const entryType: TowerNodeType =
    floor % 3 === 0 ? TowerNodeType.EVENT : TowerNodeType.COMBAT;
  const entryNode: TowerNode = {
    id: uid(),
    type: entryType,
    column: 0,
    row: 0,
    connections: [],
    completed: false,
    available: true,
    difficulty: 1,
  };
  nodeColumns.push([entryNode]);

  // Middle columns: 2 to pathWidth nodes each
  for (let col = 1; col < numColumns - 1; col++) {
    const rowCount = Math.min(pathWidth, Math.max(2, nodeCount - 2));
    const column: TowerNode[] = [];
    for (let row = 0; row < rowCount; row++) {
      const nodeType: TowerNodeType = pickWeighted(weights as [TowerNodeType, number][]);
      column.push({
        id: uid(),
        type: nodeType,
        column: col,
        row,
        connections: [],
        completed: false,
        available: false,
        difficulty: 1 + Math.floor(col / 2),
      });
    }
    nodeColumns.push(column);
  }

  // Final column: boss node
  const bossNode: TowerNode = {
    id: uid(),
    type: isBossFloor(floor) ? TowerNodeType.ELITE : TowerNodeType.COMBAT,
    column: numColumns - 1,
    row: 0,
    connections: [],
    completed: false,
    available: false,
    difficulty: 3,
  };
  nodeColumns.push([bossNode]);

  // Wire connections: each node in column N connects to 1–2 random nodes in column N+1
  for (let col = 0; col < nodeColumns.length - 1; col++) {
    const currentCol = nodeColumns[col];
    const nextCol = nodeColumns[col + 1];
    for (const node of currentCol) {
      // Always connect to at least 1 node in the next column
      const primaryTarget = nextCol[Math.floor(Math.random() * nextCol.length)];
      node.connections.push(primaryTarget.id);
      // Optionally connect to a second node
      if (nextCol.length > 1 && Math.random() < 0.4) {
        const secondaries = nextCol.filter(n => n.id !== primaryTarget.id);
        if (secondaries.length > 0) {
          node.connections.push(pickRandom(secondaries).id);
        }
      }
    }
    // Ensure every node in nextCol is reachable from at least one node in currentCol
    for (const nextNode of nextCol) {
      const isReachable = currentCol.some(n => n.connections.includes(nextNode.id));
      if (!isReachable) {
        const randomSource = currentCol[Math.floor(Math.random() * currentCol.length)];
        if (!randomSource.connections.includes(nextNode.id)) {
          randomSource.connections.push(nextNode.id);
        }
      }
    }
  }

  return {
    floorNumber: floor,
    act,
    nodeColumns,
    bossNodeId: bossNode.id,
  };
}

// ─── NODE AVAILABILITY ────────────────────────────────────────────────────────

/**
 * Returns the list of nodes the player can currently enter.
 * A node is available if:
 *  - it is not completed, AND
 *  - it is explicitly marked available (set during node completion)
 */
export function getAvailableNodes(map: TowerFloorMap): TowerNode[] {
  return map.nodeColumns.flat().filter(n => n.available && !n.completed);
}

/**
 * Marks a node as completed and unlocks the nodes it connects to.
 * Returns an updated copy of the map.
 */
export function completeNode(map: TowerFloorMap, nodeId: string): TowerFloorMap {
  const newColumns = map.nodeColumns.map(col =>
    col.map(node => {
      if (node.id === nodeId) return { ...node, completed: true, available: false };
      return node;
    })
  );

  // Find the completed node to get its connections
  const completedNode = map.nodeColumns.flat().find(n => n.id === nodeId);
  if (completedNode) {
    for (const connId of completedNode.connections) {
      for (const col of newColumns) {
        for (const node of col) {
          if (node.id === connId) node.available = true;
        }
      }
    }
  }

  return { ...map, nodeColumns: newColumns };
}

// ─── ENEMY SCALING ────────────────────────────────────────────────────────────

/**
 * Returns a copy of an enemy scaled for a specific floor and loop.
 * - Floor scaling: +5% HP/ATK per floor
 * - Loop scaling: multiplicative from TOWER_DIFFICULTY_SCALE_PER_LOOP
 */
export function scaleEnemyForTower(enemy: Enemy, floor: number, loop: number = 0): Enemy {
  const floorMult = 1 + (floor - 1) * 0.05;
  const loopHp   = Math.pow(TOWER_DIFFICULTY_SCALE_PER_LOOP.hp,  loop);
  const loopAtk  = Math.pow(TOWER_DIFFICULTY_SCALE_PER_LOOP.atk, loop);
  const loopDef  = Math.pow(TOWER_DIFFICULTY_SCALE_PER_LOOP.def, loop);

  return {
    ...enemy,
    stats: {
      ...enemy.stats,
      hp:    Math.round(enemy.stats.hp    * floorMult * loopHp),
      maxHp: Math.round(enemy.stats.maxHp * floorMult * loopHp),
      atk:   Math.round(enemy.stats.atk   * floorMult * loopAtk),
      def:   Math.round(enemy.stats.def   * floorMult * loopDef),
    },
  };
}

// ─── RUN CARD EFFECTS ────────────────────────────────────────────────────────

/**
 * Returns a copy of the player with all active run card stat bonuses applied.
 * Only applies `stat + statBonus` effects; special effects like secondWind
 * are handled at combat resolution time.
 */
export function applyRunCardEffects(player: Player, cards: RunCard[]): Player {
  let p = { ...player, stats: { ...player.stats } };
  for (const card of cards) {
    for (const effect of card.effects) {
      if (effect.stat && effect.statBonus !== undefined) {
        const key = effect.stat as keyof typeof p.stats;
        (p.stats as Record<string, number>)[key] =
          ((p.stats as Record<string, number>)[key] ?? 0) + effect.statBonus;
      }
    }
  }
  return p;
}

// ─── RUN STATE CREATION ───────────────────────────────────────────────────────

/**
 * Builds a fresh TowerRunState from the current player and tower meta.
 * The player's HUB equipment is snapshotted and also set as initial run equipment.
 */
export function buildTowerRunState(
  player: Player,
  meta: TowerMeta,
  consumableSlots: ConsumableSlot[]
): TowerRunState {
  const floor = 1;
  const floorMap = generateFloorMap(floor, 0);

  const emptyRewards: TowerRunRewards = {
    gold: 0,
    xp: 0,
    essenceEarned: 0,
    drops: {},
  };

  return {
    floor,
    act: 1,
    loop: 0,
    currentFloorMap: floorMap,
    completedNodeIds: [],
    selectedNodeId: null,
    entrySnapshot: JSON.parse(JSON.stringify(player)) as Player,
    runEquipment: {
      weapon: player.equippedWeapon,
      armor:  player.equippedArmor,
      helmet: player.equippedHelmet,
      legs:   player.equippedLegs,
      shield: player.equippedShield,
    },
    consumableSlots,
    runCards: [],
    accumulatedRewards: emptyRewards,
    phase: 'map',
  };
}

// ─── CONSUMABLE SLOTS ─────────────────────────────────────────────────────────

/** Creates empty consumable slots based on the current meta level. */
export function createEmptyConsumableSlots(meta: TowerMeta): ConsumableSlot[] {
  const count = TOWER_CONSUMABLE_SLOTS_BY_LEVEL[meta.consumableSlotsLevel] ?? 3;
  return Array.from({ length: count }, () => ({
    itemId: null,
    quantity: 0,
    maxQuantity: TOWER_CONSUMABLE_MAX_STACK,
  }));
}

// ─── DEATH RESOLUTION ────────────────────────────────────────────────────────

/**
 * Handles tower run death: restores the player to the HUB equipment snapshot.
 * Returns the restored player; no Essência is awarded on death.
 */
export function resolveTowerDeath(state: TowerRunState): Player {
  const snap = state.entrySnapshot;
  // Restore HP/MP to values from snapshot to avoid full-heal abuse
  return JSON.parse(JSON.stringify(snap)) as Player;
}

// ─── FLOOR ADVANCEMENT ───────────────────────────────────────────────────────

/**
 * Advances the run to the next floor, generating a new map.
 * Checks if the tower should loop (after floor 15).
 */
export function advanceToNextFloor(state: TowerRunState): TowerRunState {
  const totalFloors = TOWER_FLOORS_PER_ACT * TOWER_ACTS;
  let nextFloor = state.floor + 1;
  let nextLoop = state.loop;

  if (nextFloor > totalFloors) {
    nextFloor = 1;
    nextLoop += 1;
  }

  const nextAct = getActForFloor(nextFloor);
  const nextMap = generateFloorMap(nextFloor, nextLoop);

  return {
    ...state,
    floor: nextFloor,
    act: nextAct,
    loop: nextLoop,
    currentFloorMap: nextMap,
    completedNodeIds: [],
    selectedNodeId: null,
    phase: 'map',
  };
}

// ─── ESSENCE REWARD ───────────────────────────────────────────────────────────

/** Returns 1 Essência if this floor is an act boss floor, otherwise 0. */
export function calculateEssenceReward(floor: number): number {
  return (TOWER_BOSS_FLOORS as readonly number[]).includes(floor) ? 1 : 0;
}

// ─── SANCTUARY OPTIONS ────────────────────────────────────────────────────────

/**
 * Returns exactly 3 sanctuary options: 1 safe (heal), 1 build (card), 1 variable.
 */
export function getSanctuaryOptions(_floor: number, _act: number): TowerSanctuaryOption[] {
  const heal = pickRandom(SANCTUARY_HEAL_OPTIONS);
  const card = pickRandom(SANCTUARY_CARD_OPTIONS);
  const variable = pickRandom(SANCTUARY_VARIABLE_OPTIONS);
  return [heal, card, variable];
}

// ─── RUN CARD POOL OFFER ─────────────────────────────────────────────────────

/**
 * Returns 3 random run cards for the player to choose from (at upgrade nodes).
 * Avoids offering cards already in the player's hand.
 */
export function getRunCardOffer(existingCardIds: string[]): RunCard[] {
  const available = TOWER_RUN_CARDS.filter(c => !existingCardIds.includes(c.id));
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

// ─── TOWER SHOP ITEMS ─────────────────────────────────────────────────────────

/** Returns 3 random consumable/potion items for the tower mini-shop. */
export function getTowerShopItems(allItems: Item[]): Item[] {
  const potions = allItems.filter(i => i.type === 'potion');
  const shuffled = potions.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

// ─── META HELPERS ─────────────────────────────────────────────────────────────

/** Returns a default TowerMeta for new saves. */
export function getDefaultTowerMeta(): TowerMeta {
  return { ...DEFAULT_TOWER_META };
}

/** Applies the accumulated rewards from a run onto the player. */
export function applyTowerRunRewardsToPlayer(
  player: Player,
  rewards: TowerRunRewards
): Player {
  return {
    ...player,
    gold: player.gold + rewards.gold,
    xp:   player.xp   + rewards.xp,
  };
}
