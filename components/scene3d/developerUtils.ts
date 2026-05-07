import { PlayerClassId } from '../../types';
import { getPlayerClassById } from '../../game/data/classes';
import { RuntimeHeroAssets, hasRuntimeFbxAssets } from './animation';
import type { DeveloperAnimationRuntimeDiagnostic } from './types';

export const resolveRuntimeClassAssets = (classId: PlayerClassId): RuntimeHeroAssets | null => {
  const assets = getPlayerClassById(classId).assets;
  return hasRuntimeFbxAssets(assets) ? assets : null;
};

export const upsertRuntimeDiagnostic = (
  current: Record<string, DeveloperAnimationRuntimeDiagnostic>,
  diagnostic: DeveloperAnimationRuntimeDiagnostic,
) => {
  const previous = current[diagnostic.previewId];

  if (
    previous
    && previous.previewId === diagnostic.previewId
    && previous.label === diagnostic.label
    && previous.animationAction === diagnostic.animationAction
    && previous.targetClipName === diagnostic.targetClipName
    && previous.automaticClipName === diagnostic.automaticClipName
    && previous.boundClipCount === diagnostic.boundClipCount
    && previous.actionStarted === diagnostic.actionStarted
    && previous.status === diagnostic.status
  ) {
    return current;
  }

  return {
    ...current,
    [diagnostic.previewId]: diagnostic,
  };
};
