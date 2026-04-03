import type {
  SpritePlaybackMode,
  SpriteOverlayAnimationDefinition,
  SpriteTrackDefinition,
  SpriteTrackPlaybackStatus,
} from '../../types';

export interface SpriteTrackPlaybackSnapshot {
  status: SpriteTrackPlaybackStatus;
  playbackMode: SpritePlaybackMode;
  frameIndex: number; // `-1` means empty frame.
  totalDurationMs: number;
  elapsedWithinCycleMs: number;
}

const SPRITE_TIMELINE_FPS = 60;

const getFrameDurationMs = (track: SpriteTrackDefinition, frameIndex: number) => {
  const baseFrameDuration = 1000 / Math.max(1, track.fps || 1);
  const override = track.frameDurationOverridesMs?.[frameIndex];
  return override && override > 0 ? override : baseFrameDuration;
};

type TimelineEntry = {
  frameIndex: number;
  sourceIndex: number;
};

const buildTimelineFrames = (track: SpriteTrackDefinition): TimelineEntry[] => {
  const timeline: TimelineEntry[] = [];
  if (track.startEmptyFrame !== false) {
    timeline.push({ frameIndex: -1, sourceIndex: -1 });
  }
  const baseFrames = [...track.frameIndices];
  baseFrames.forEach((frameIndex, sourceIndex) => {
    timeline.push({ frameIndex, sourceIndex });
  });
  if ((track.tailLoopEnabled ?? false) && baseFrames.length > 0) {
    const tailCount = Math.max(1, Math.min(baseFrames.length, Math.floor(track.tailLoopFrameCount ?? 1)));
    const repeats = Math.max(0, Math.floor(track.tailLoopRepeats ?? 0));
    const pattern = track.tailLoopPattern ?? 'forward';
    if (repeats > 0) {
      const tailStart = baseFrames.length - tailCount;
      const appendForward = () => {
        for (let offset = 0; offset < tailCount; offset += 1) {
          const sourceIndex = tailStart + offset;
          timeline.push({ frameIndex: baseFrames[sourceIndex], sourceIndex });
        }
      };
      const appendBackward = () => {
        if (tailCount <= 1) return;
        for (let sourceIndex = (baseFrames.length - 2); sourceIndex >= tailStart; sourceIndex -= 1) {
          timeline.push({ frameIndex: baseFrames[sourceIndex], sourceIndex });
        }
      };
      for (let i = 0; i < repeats; i += 1) {
        appendForward();
        if (pattern === 'ping-pong') {
          appendBackward();
        }
      }
    }
  }
  if (track.endEmptyFrame !== false) {
    timeline.push({ frameIndex: -1, sourceIndex: -1 });
  }
  return timeline;
};

const getTimelineDurationMs = (track: SpriteTrackDefinition, timeline: TimelineEntry[]): number => {
  if (timeline.length === 0) {
    return 0;
  }

  return timeline.reduce((sum, entry) => {
    return sum + getFrameDurationMs(track, Math.max(0, entry.sourceIndex));
  }, 0);
};

export const estimateTrackPlaybackDurationMs = (track: SpriteTrackDefinition): number => {
  const timeline = buildTimelineFrames(track);
  return getTimelineDurationMs(track, timeline);
};

export const estimateAnimationPlaybackDurationMs = (definition: SpriteOverlayAnimationDefinition | null | undefined): number => {
  if (!definition) {
    return 0;
  }
  const enabledTracks = (definition.spriteTracks ?? []).filter((track) => track.enabled !== false);
  if (enabledTracks.length === 0) {
    return 0;
  }
  return enabledTracks.reduce((maxDuration, track) => {
    const trackDuration = estimateTrackPlaybackDurationMs(track);
    return Math.max(maxDuration, trackDuration);
  }, 0);
};

const getFrameByElapsed = (track: SpriteTrackDefinition, timeline: TimelineEntry[], elapsedMs: number): number => {
  if (timeline.length === 0) {
    return -1;
  }

  let cursor = 0;
  for (let timelineIndex = 0; timelineIndex < timeline.length; timelineIndex += 1) {
    cursor += getFrameDurationMs(track, Math.max(0, timeline[timelineIndex].sourceIndex));
    if (elapsedMs < cursor) {
      return timeline[timelineIndex].frameIndex;
    }
  }

  return timeline[timeline.length - 1].frameIndex;
};

export const resolveTrackPlaybackSnapshot = ({
  track,
  elapsedMs,
  isPlaying,
  forcePreviewLoop = false,
}: {
  track: SpriteTrackDefinition;
  elapsedMs: number;
  isPlaying: boolean;
  forcePreviewLoop?: boolean;
}): SpriteTrackPlaybackSnapshot => {
  const effectiveMode: SpritePlaybackMode = forcePreviewLoop ? 'loop' : track.playbackMode;
  const startFrame = Math.max(0, Math.floor(track.timelineStartFrame ?? 0));
  const startMs = (startFrame * 1000) / SPRITE_TIMELINE_FPS;
  const endFrame = track.timelineEndFrame != null
    ? Math.max(startFrame, Math.floor(track.timelineEndFrame))
    : null;
  const endMs = endFrame != null ? (endFrame * 1000) / SPRITE_TIMELINE_FPS : null;
  const timeline = buildTimelineFrames(track);
  const totalDurationMs = getTimelineDurationMs(track, timeline);

  if (timeline.length === 0 || totalDurationMs <= 0) {
    return {
      status: 'idle',
      playbackMode: effectiveMode,
      frameIndex: -1,
      totalDurationMs,
      elapsedWithinCycleMs: 0,
    };
  }

  if (!isPlaying) {
    return {
      status: 'idle',
      playbackMode: effectiveMode,
      frameIndex: startMs > 0 ? -1 : getFrameByElapsed(track, timeline, 0),
      totalDurationMs,
      elapsedWithinCycleMs: 0,
    };
  }

  if (elapsedMs < startMs) {
    return {
      status: 'idle',
      playbackMode: effectiveMode,
      frameIndex: -1,
      totalDurationMs,
      elapsedWithinCycleMs: 0,
    };
  }

  const trackElapsedMs = elapsedMs - startMs;
  if (endMs != null && elapsedMs >= endMs) {
    return {
      status: 'finished',
      playbackMode: effectiveMode,
      frameIndex: -1,
      totalDurationMs,
      elapsedWithinCycleMs: trackElapsedMs,
    };
  }

  if (effectiveMode === 'loop') {
    const elapsedWithinCycleMs = ((trackElapsedMs % totalDurationMs) + totalDurationMs) % totalDurationMs;
    return {
      status: 'playing',
      playbackMode: effectiveMode,
      frameIndex: getFrameByElapsed(track, timeline, elapsedWithinCycleMs),
      totalDurationMs,
      elapsedWithinCycleMs,
    };
  }

  const clampedElapsed = Math.max(0, Math.min(trackElapsedMs, totalDurationMs));
  const finished = trackElapsedMs >= totalDurationMs;

  return {
    status: finished ? 'finished' : 'playing',
    playbackMode: effectiveMode,
    frameIndex: finished && track.stopOnLastFrame !== false
      ? timeline[timeline.length - 1].frameIndex
      : getFrameByElapsed(track, timeline, clampedElapsed),
    totalDurationMs,
    elapsedWithinCycleMs: clampedElapsed,
  };
};
