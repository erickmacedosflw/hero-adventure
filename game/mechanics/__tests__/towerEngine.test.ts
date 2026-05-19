import { describe, expect, it } from 'vitest';
import { TowerNodeType } from '../../../types';
import { completeNode, generateFloorMap, getAvailableNodes } from '../towerEngine';

describe('tower engine', () => {
  it('generates playable floor maps with forward-only reachable columns', () => {
    for (let floor = 1; floor <= 15; floor += 1) {
      const map = generateFloorMap(floor);

      expect(map.nodeColumns).toHaveLength(3);
      expect(map.nodeColumns[0]).toHaveLength(1);
      expect(map.nodeColumns.at(-1)).toHaveLength(1);
      expect(map.nodeColumns.at(-1)?.[0].id).toBe(map.bossNodeId);

      for (let col = 0; col < map.nodeColumns.length - 1; col += 1) {
        const currentColumn = map.nodeColumns[col];
        const nextColumn = map.nodeColumns[col + 1];
        const nextIds = new Set(nextColumn.map((node) => node.id));

        for (const node of currentColumn) {
          expect(node.connections.length).toBeGreaterThanOrEqual(1);
          expect(node.connections.every((id) => nextIds.has(id))).toBe(true);
        }

        for (const nextNode of nextColumn) {
          expect(currentColumn.some((node) => node.connections.includes(nextNode.id))).toBe(true);
        }
      }
    }
  });

  it('marks the entry node available and uses elite nodes on boss floors', () => {
    const normalMap = generateFloorMap(4);
    const bossMap = generateFloorMap(5);

    expect(getAvailableNodes(normalMap)).toEqual([normalMap.nodeColumns[0][0]]);
    expect(normalMap.nodeColumns.at(-1)?.[0].type).toBe(TowerNodeType.COMBAT);
    expect(bossMap.nodeColumns.at(-1)?.[0].type).toBe(TowerNodeType.ELITE);
  });

  it('completes a node immutably and unlocks its connected nodes', () => {
    const map = generateFloorMap(1);
    const entryNode = map.nodeColumns[0][0];
    const nextMap = completeNode(map, entryNode.id);
    const availableIds = new Set(getAvailableNodes(nextMap).map((node) => node.id));

    expect(nextMap).not.toBe(map);
    expect(nextMap.nodeColumns[0][0]).toMatchObject({
      id: entryNode.id,
      completed: true,
      available: false,
    });
    expect(map.nodeColumns[0][0]).toMatchObject({
      completed: false,
      available: true,
    });
    expect(entryNode.connections.every((id) => availableIds.has(id))).toBe(true);
  });
});