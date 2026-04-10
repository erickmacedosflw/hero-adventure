import { useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TextureLoader } from 'three';
import { DungeonBossTemplate, DungeonEnemyTemplate, EnemyTemplate, PlayerClassDefinition, PlayerClassId, PlayerClassAssets } from '../../types';
import { getPlayerClassById } from '../data/classes';

type RuntimeEnemy = EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate;
type QueueEntry = { kind: 'fbx' | 'texture'; url: string };

let hasWarmupStarted = false;

const isLikelyMobileOrIOS = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const isTouchMac = userAgent.includes('Mac') && touchPoints > 1;
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || isTouchMac;
  const isMobileUa = /android|iphone|ipad|ipod|mobile/i.test(userAgent.toLowerCase());
  const compactViewport = window.innerWidth < 1024;

  return isIOS || isMobileUa || (touchPoints > 1 && compactViewport);
};

const isRuntimeAssetUrl = (url?: string | null) => (
  typeof url === 'string' && url.length > 0 && !url.includes('undefined')
);

const isRuntimeFbxAssets = (assets?: PlayerClassAssets | null) => (
  Boolean(
    assets
    && assets.implementationStatus === 'fbx'
    && isRuntimeAssetUrl(assets.modelUrl)
    && isRuntimeAssetUrl(assets.textureUrl),
  )
);

const enqueueAssets = (queue: QueueEntry[], assets?: PlayerClassAssets | null) => {
  if (!isRuntimeFbxAssets(assets)) {
    return;
  }

  queue.push({ kind: 'fbx', url: assets.modelUrl });
  queue.push({ kind: 'texture', url: assets.textureUrl });

  assets.animationUrls?.forEach((url) => {
    if (!isRuntimeAssetUrl(url)) {
      return;
    }
    queue.push({ kind: 'fbx', url });
  });
};

const dedupeQueue = (queue: QueueEntry[]) => {
  const seen = new Set<string>();
  return queue.filter((entry) => {
    const key = `${entry.kind}:${entry.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const preloadEntry = (entry: QueueEntry) => {
  try {
    if (entry.kind === 'fbx') {
      useLoader.preload(FBXLoader, entry.url);
      return;
    }

    useLoader.preload(TextureLoader, entry.url);
  } catch (error) {
    console.warn('[Warmup] Falha ao iniciar preload de asset.', entry.url, error);
  }
};

const scheduleProgressiveWarmup = (entries: QueueEntry[]) => {
  if (entries.length === 0 || typeof window === 'undefined') {
    return;
  }

  const constrainedDevice = isLikelyMobileOrIOS();
  let cursor = 0;
  const chunkSize = constrainedDevice ? 1 : 2;
  const nextChunkDelayMs = constrainedDevice ? 180 : 90;
  const firstChunkDelayMs = constrainedDevice ? 260 : 120;

  const runChunk = () => {
    if (cursor >= entries.length) {
      return;
    }

    const end = Math.min(entries.length, cursor + chunkSize);
    for (let index = cursor; index < end; index += 1) {
      preloadEntry(entries[index]);
    }
    cursor = end;

    if (cursor < entries.length) {
      window.setTimeout(runChunk, nextChunkDelayMs);
    }
  };

  window.setTimeout(runChunk, firstChunkDelayMs);
};

export const warmupBattleRuntimeAssets = ({
  playerClasses,
  enemies,
  activeClassId,
}: {
  playerClasses: PlayerClassDefinition[];
  enemies: RuntimeEnemy[];
  activeClassId: PlayerClassId;
}) => {
  if (hasWarmupStarted) {
    return;
  }
  hasWarmupStarted = true;

  const queue: QueueEntry[] = [];
  const activeClass = playerClasses.find((entry) => entry.id === activeClassId);
  const knightClass = getPlayerClassById('knight');
  const constrainedDevice = isLikelyMobileOrIOS();

  // Prioritize current class and knight rig reference to remove first-combat hitches.
  enqueueAssets(queue, activeClass?.assets);
  enqueueAssets(queue, knightClass.assets);

  if (!constrainedDevice) {
    enemies.forEach((enemy) => enqueueAssets(queue, enemy.assets));
  }

  const uniqueQueue = dedupeQueue(queue);
  scheduleProgressiveWarmup(uniqueQueue);
};
