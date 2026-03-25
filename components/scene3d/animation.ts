import * as THREE from 'three';
import type { PlayerAnimationAction, PlayerClassAnimationMap, PlayerClassAssets } from '../../types';

export type RuntimeHeroAssets = PlayerClassAssets & {
  modelUrl: string;
  textureUrl: string;
  animationUrls: string[];
};

export const normalizeRigName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export const normalizeMeshName = (value: string): string => value.toLowerCase();

export const getTrackBindingTargetName = (trackName: string): string => {
  const propertyIndex = trackName.indexOf('.');
  return propertyIndex >= 0 ? trackName.slice(0, propertyIndex) : trackName;
};

export const collectBoneNames = (root: THREE.Object3D): string[] => {
  const names: string[] = [];

  root.traverse((node) => {
    if ((node as THREE.Bone).isBone) {
      names.push(node.name);
    }
  });

  return names;
};

export const createNormalizedBoneLookup = (boneNames: string[]): Map<string, string> => {
  const lookup = new Map<string, string>();

  boneNames.forEach((boneName) => {
    const normalized = normalizeRigName(boneName);

    if (normalized && !lookup.has(normalized)) {
      lookup.set(normalized, boneName);
    }
  });

  return lookup;
};

export const remapClipBindingsToSkeleton = ({
  clips,
  targetModel,
}: {
  clips: THREE.AnimationClip[];
  targetModel: THREE.Object3D;
}): THREE.AnimationClip[] => {
  const targetBoneLookup = createNormalizedBoneLookup(collectBoneNames(targetModel));

  return clips.map((clip) => {
    const remappedClip = clip.clone();
    remappedClip.tracks = remappedClip.tracks.map((track) => {
      const bindingTarget = getTrackBindingTargetName(track.name);
      const remappedBindingTarget = targetBoneLookup.get(normalizeRigName(bindingTarget));

      if (!remappedBindingTarget || remappedBindingTarget === bindingTarget) {
        return track;
      }

      const clonedTrack = track.clone();
      clonedTrack.name = `${remappedBindingTarget}${track.name.slice(bindingTarget.length)}`;
      return clonedTrack;
    });

    return remappedClip;
  });
};

export const createRigComparisonReport = ({
  targetModel,
  referenceModel,
  clips,
}: {
  targetModel: THREE.Object3D;
  referenceModel: THREE.Object3D;
  clips: THREE.AnimationClip[];
}) => {
  const targetBones = collectBoneNames(targetModel);
  const referenceBones = collectBoneNames(referenceModel);
  const targetLookup = createNormalizedBoneLookup(targetBones);
  const referenceLookup = createNormalizedBoneLookup(referenceBones);
  const uniqueTrackTargets = [...new Set(clips.flatMap((clip) => clip.tracks.map((track) => getTrackBindingTargetName(track.name))))];
  const exactTargetBones = new Set(targetBones);

  return {
    targetBoneCount: targetBones.length,
    knightBoneCount: referenceBones.length,
    clipCount: clips.length,
    clipNames: clips.map((clip) => clip.name),
    trackTargetCount: uniqueTrackTargets.length,
    exactTrackMatchCount: uniqueTrackTargets.filter((target) => exactTargetBones.has(target)).length,
    normalizedTrackMatchCount: uniqueTrackTargets.filter((target) => targetLookup.has(normalizeRigName(target))).length,
    missingTrackTargets: uniqueTrackTargets.filter((target) => !targetLookup.has(normalizeRigName(target))),
    sharedBoneCountWithKnight: referenceBones.filter((boneName) => targetLookup.has(normalizeRigName(boneName))).length,
    missingBonesVsKnight: referenceBones.filter((boneName) => !targetLookup.has(normalizeRigName(boneName))),
    extraBonesVsKnight: targetBones.filter((boneName) => !referenceLookup.has(normalizeRigName(boneName))),
    targetBones,
    knightBones: referenceBones,
  };
};

const HERO_ANIMATION_PATTERNS: Record<PlayerAnimationAction, RegExp[]> = {
  idle: [/idle_a/i, /idle/i, /general/i, /stand/i],
  'battle-idle': [/melee_unarmed_idle/i, /combatmelee/i, /idle/i],
  attack: [/melee_1h_attack_jump_chop/i, /melee_unarmed_attack_punch_a/i, /attack/i, /combatmelee/i],
  defend: [/melee_blocking/i, /block/i, /guard/i],
  'defend-hit': [/melee_block_hit/i, /block_hit/i, /block/i],
  hit: [/hit_a/i, /hit/i, /impact/i],
  'critical-hit': [/hit_b/i, /hit/i, /impact/i, /stagger/i],
  item: [/ranged_magic_raise/i, /use_item/i, /magic/i],
  heal: [/use_item/i, /item/i, /heal/i],
  skill: [/ranged_magic_raise/i, /magic/i, /cast/i],
  evade: [/dodge_left/i, /dodge_right/i, /dodge/i],
  death: [/death_a/i, /death/i, /die/i, /knockdown/i],
};

export const hasRuntimeFbxAssets = (assets?: PlayerClassAssets | null): assets is RuntimeHeroAssets => (
  Boolean(assets)
  && assets.implementationStatus === 'fbx'
  && typeof assets.modelUrl === 'string'
  && typeof assets.textureUrl === 'string'
  && Array.isArray(assets.animationUrls)
  && assets.animationUrls.length > 0
);

const resolvePreferredAnimationBundleFileName = (
  assets: RuntimeHeroAssets,
  animationAction: PlayerAnimationAction,
  preferredBundleName?: string,
) => {
  if (preferredBundleName) {
    const explicitMatch = assets.animationFiles.find((fileName) => (
      fileName === preferredBundleName || fileName.replace(/\.fbx$/i, '') === preferredBundleName
    ));

    if (explicitMatch) {
      return explicitMatch;
    }
  }

  const preferredPatterns: RegExp[] = (() => {
    switch (animationAction) {
      case 'battle-idle':
      case 'attack':
      case 'defend':
      case 'defend-hit':
      case 'hit':
      case 'critical-hit':
      case 'death':
        return [/combatmelee/i, /general/i];
      case 'item':
      case 'heal':
      case 'skill':
        return [/combatranged/i, /general/i];
      case 'evade':
        return [/movementadvanced/i, /general/i];
      case 'idle':
      default:
        return [/general/i];
    }
  })();

  for (const pattern of preferredPatterns) {
    const matchedFileName = assets.animationFiles.find((fileName) => pattern.test(fileName));

    if (matchedFileName) {
      return matchedFileName;
    }
  }

  return assets.animationFiles[0];
};

export const selectPrimaryAnimationBundle = (
  assets: RuntimeHeroAssets,
  animationAction: PlayerAnimationAction,
  preferredBundleName?: string,
) => {
  const preferredFileName = resolvePreferredAnimationBundleFileName(assets, animationAction, preferredBundleName);
  const selectedIndex = Math.max(assets.animationFiles.findIndex((fileName) => fileName === preferredFileName), 0);

  return {
    fileName: assets.animationFiles[selectedIndex],
    url: assets.animationUrls[selectedIndex],
  };
};

export const selectSecondaryAnimationBundles = (
  assets: RuntimeHeroAssets,
  primaryFileName: string,
  includeAllBundles = false,
  includeSecondaryBundles = true,
) => (
  assets.animationFiles
    .map((fileName, index) => ({ fileName, url: assets.animationUrls[index] }))
    .filter((bundle) => Boolean(bundle.url) && bundle.fileName !== primaryFileName)
    .filter(() => includeSecondaryBundles)
    .filter((bundle) => includeAllBundles || /combatmelee|combatranged|movementadvanced|general/i.test(bundle.fileName)) as Array<{ fileName: string; url: string }>
);

export const scoreClipForState = (clipName: string, state: PlayerAnimationAction): number => {
  const normalizedName = clipName.toLowerCase();
  let score = 0;

  HERO_ANIMATION_PATTERNS[state].forEach((pattern, index) => {
    if (pattern.test(normalizedName)) {
      score += 18 - index * 2;
    }
  });

  if (state === 'attack' && /idle|defend|block/.test(normalizedName)) {
    score -= 14;
  }

  if (state === 'defend' && /attack|slash|strike/.test(normalizedName)) {
    score -= 12;
  }

  if (state === 'idle' && /attack|combat/.test(normalizedName)) {
    score -= 16;
  }

  score -= Math.min(normalizedName.length / 12, 6);
  return score;
};

export const findBestClipName = (clips: THREE.AnimationClip[], state: PlayerAnimationAction): string | undefined => {
  const rankedClips = clips
    .map((clip) => ({ name: clip.name, score: scoreClipForState(clip.name, state) }))
    .sort((left, right) => right.score - left.score);

  return rankedClips[0]?.name;
};

export const findFirstMatchingClipName = (clips: THREE.AnimationClip[], candidates: readonly string[]): string | undefined => {
  const availableNames = new Set(clips.map((clip) => clip.name));
  return candidates.find((candidate) => availableNames.has(candidate));
};

export const resolveAutomaticClipName = ({
  clips,
  animationMap,
  action,
  hasWeapon,
  equippedWeaponGrip,
  evadeDirection,
}: {
  clips: THREE.AnimationClip[];
  animationMap?: PlayerClassAnimationMap;
  action: PlayerAnimationAction;
  hasWeapon: boolean;
  equippedWeaponGrip?: string | null;
  evadeDirection: 'left' | 'right';
}): string | undefined => {
  const configuredCandidates = (() => {
    if (!animationMap) {
      return undefined;
    }

    switch (action) {
      case 'idle':
        return [animationMap.idle];
      case 'battle-idle': {
        const gripOverride = equippedWeaponGrip && animationMap.battleIdleByGrip?.[equippedWeaponGrip];
        return [gripOverride ?? animationMap.battleIdle];
      }
      case 'attack': {
        if (!hasWeapon) return [animationMap.attackUnarmed];
        const gripOverride = equippedWeaponGrip && animationMap.attackByGrip?.[equippedWeaponGrip];
        return [gripOverride ?? animationMap.attackWeapon];
      }
      case 'defend':
        return [animationMap.defend];
      case 'defend-hit':
        return [animationMap.defendHit];
      case 'hit':
        return [animationMap.hit];
      case 'critical-hit':
        return [animationMap.criticalHit];
      case 'item':
        return [animationMap.item];
      case 'heal':
        return [animationMap.heal];
      case 'skill':
        return [animationMap.skill];
      case 'evade':
        return [evadeDirection === 'left' ? animationMap.evadeLeft : animationMap.evadeRight];
      case 'death':
        return [animationMap.death];
      default:
        return undefined;
    }
  })();

  switch (action) {
    case 'idle':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'idle');
    case 'battle-idle':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'battle-idle');
    case 'attack':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'attack');
    case 'defend':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'defend');
    case 'defend-hit':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'defend-hit');
    case 'hit':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'hit');
    case 'critical-hit':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'critical-hit');
    case 'item':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'item');
    case 'heal':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'heal');
    case 'skill':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'skill');
    case 'evade':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'evade');
    case 'death':
      return findFirstMatchingClipName(clips, configuredCandidates ?? []) ?? findBestClipName(clips, 'death');
    default:
      return clips[0]?.name;
  }
};

export const buildRuntimeMaterial = (material: THREE.Material, texture: THREE.Texture): THREE.Material => {
  const sourceMaterial = material as THREE.Material & {
    color?: THREE.Color;
    opacity?: number;
    transparent?: boolean;
    side?: THREE.Side;
    alphaTest?: number;
  };

  const runtimeMaterial = new THREE.MeshStandardMaterial({
    color: sourceMaterial.color?.clone() ?? new THREE.Color('#ffffff'),
    map: texture,
    transparent: Boolean(sourceMaterial.transparent) || (sourceMaterial.opacity ?? 1) < 1,
    opacity: sourceMaterial.opacity ?? 1,
    side: sourceMaterial.side ?? THREE.FrontSide,
    alphaTest: sourceMaterial.alphaTest ?? 0,
    roughness: 0.82,
    metalness: 0.08,
  });

  runtimeMaterial.needsUpdate = true;
  return runtimeMaterial;
};

export const prepareExternalTexture = (texture: THREE.Texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
};

export const createNormalizedBoneObjectLookup = (root: THREE.Object3D): Map<string, THREE.Bone> => {
  const lookup = new Map<string, THREE.Bone>();

  root.traverse((node) => {
    const bone = node as THREE.Bone;

    if (!bone.isBone) {
      return;
    }

    const normalized = normalizeRigName(bone.name);
    if (normalized && !lookup.has(normalized)) {
      lookup.set(normalized, bone);
    }
  });

  return lookup;
};

export const RIGHT_HAND_BONE_CANDIDATES = [
  'weaponright',
  'propright',
  'attachright',
  'weaponr',
  'propr',
  'mixamorigrighthand',
  'mixamorighandr',
  'mixamorigrightwrist',
  'handright',
  'wristright',
  'righthand',
  'rightwrist',
  'rightpalm',
  'handr',
  'wristr',
  'brhand',
  'rhand',
  'righthandthumb1',
  'righthandindex1',
  'righthandmiddle1',
];

const RIGHT_ARM_BONE_FALLBACK_CANDIDATES = [
  'armright',
  'forearmright',
  'mixamorigrightforearm',
  'mixamorigrightarm',
  'rightforearm',
  'rightlowerarm',
  'rightarm',
  'forearmr',
  'lowerarmr',
  'armr',
  'upperarmr',
];

export const findAttachmentBone = (root: THREE.Object3D, candidates: string[]) => {
  let matchedBone: THREE.Bone | null = null;
  let fallbackBone: THREE.Bone | null = null;
  let armFallbackBone: THREE.Bone | null = null;

  root.traverse((node) => {
    if (matchedBone) {
      return;
    }

    const bone = node as THREE.Bone;
    if (!bone.isBone) {
      return;
    }

    const normalizedName = normalizeRigName(bone.name);
    if (candidates.some((candidate) => normalizedName.includes(candidate))) {
      if (!normalizedName.includes('left')) {
        matchedBone = bone;
      }
      return;
    }

    if (!fallbackBone && normalizedName.includes('right') && (normalizedName.includes('hand') || normalizedName.includes('wrist') || normalizedName.includes('weapon'))) {
      fallbackBone = bone;
    }

    if (!armFallbackBone && RIGHT_ARM_BONE_FALLBACK_CANDIDATES.some((candidate) => normalizedName.includes(candidate))) {
      armFallbackBone = bone;
    }
  });

  return matchedBone ?? fallbackBone ?? armFallbackBone;
};

export const getDominantBoundsAxis = (size: THREE.Vector3): 'x' | 'y' | 'z' => {
  if (size.x >= size.y && size.x >= size.z) {
    return 'x';
  }

  if (size.y >= size.x && size.y >= size.z) {
    return 'y';
  }

  return 'z';
};