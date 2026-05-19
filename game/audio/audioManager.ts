import { battleSfx } from './sfx';
import { gameMusicManager, type MusicTrackId } from './music';
import { uiSfx } from './uiSfx';
import { getAudioRuntimeStatus, markAudioUserGesture, prepareHowlerForMobileUnlock } from './recovery';

interface AudioEnabledState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

interface AudioUnlockOptions {
  targetMusicTrack: MusicTrackId | null;
  musicEnabled: boolean;
}

interface AudioRecoveryOptions extends AudioUnlockOptions {
  shouldAttemptUnlock: boolean;
  fadeMs?: number;
}

let unlockInFlight: Promise<boolean> | null = null;
let hasPreloadedSfx = false;

const getWindow = () => (typeof window === 'undefined' ? null : window);

const playMusicDuringUserGesture = (targetMusicTrack: MusicTrackId | null, musicEnabled: boolean) => {
  if (!targetMusicTrack || !musicEnabled) {
    return;
  }

  // iOS/Safari only grants WebAudio reliably when the first play happens inside
  // the same synchronous user-gesture task. Do this before any awaited resume.
  gameMusicManager.transitionTo(targetMusicTrack, 0);
};

const runManagersUnlock = async () => {
  const unlockResults = await Promise.allSettled([
    gameMusicManager.unlock(),
    battleSfx.unlock(),
    uiSfx.unlock(),
  ]);

  return unlockResults.some((result) => result.status === 'fulfilled' && result.value);
};

export const setAudioEnabled = ({ musicEnabled, sfxEnabled }: AudioEnabledState) => {
  gameMusicManager.setEnabled(musicEnabled);
  if (!musicEnabled) {
    gameMusicManager.stopAll(220);
  }

  battleSfx.setEnabled(sfxEnabled);
  uiSfx.setEnabled(sfxEnabled);
};

export const preloadUnlockedAudio = () => {
  if (hasPreloadedSfx) {
    return;
  }

  hasPreloadedSfx = true;
  const hostWindow = getWindow();
  if (!hostWindow) {
    battleSfx.preload();
    uiSfx.preload();
    return;
  }

  hostWindow.setTimeout(() => battleSfx.preload(), 0);
  hostWindow.setTimeout(() => uiSfx.preload(), 90);
};

export const unlockAllAudio = async ({ targetMusicTrack, musicEnabled }: AudioUnlockOptions) => {
  markAudioUserGesture();
  prepareHowlerForMobileUnlock();
  playMusicDuringUserGesture(targetMusicTrack, musicEnabled);

  if (!unlockInFlight) {
    unlockInFlight = runManagersUnlock().finally(() => {
      unlockInFlight = null;
    });
  }

  const isContextReady = await unlockInFlight;
  preloadUnlockedAudio();

  if (targetMusicTrack && musicEnabled) {
    gameMusicManager.transitionTo(targetMusicTrack, 0);
  }

  return isContextReady;
};

export const recoverAllAudio = async ({
  shouldAttemptUnlock,
  targetMusicTrack,
  musicEnabled,
  fadeMs = 420,
}: AudioRecoveryOptions) => {
  if (shouldAttemptUnlock) {
    markAudioUserGesture();
    prepareHowlerForMobileUnlock();
    playMusicDuringUserGesture(targetMusicTrack, musicEnabled);
  }

  const isContextReady = await runManagersUnlock();
  if (shouldAttemptUnlock && !isContextReady) {
    return false;
  }

  if (!musicEnabled || !targetMusicTrack) {
    gameMusicManager.stopAll();
    return isContextReady;
  }

  gameMusicManager.transitionTo(targetMusicTrack, fadeMs);
  return isContextReady;
};

export const getAudioRecoveryDelays = () => (getAudioRuntimeStatus().isLikelyIos ? [0, 180, 620] : [0]);

export const getAudioStatus = getAudioRuntimeStatus;

export const disposeAudio = () => {
  gameMusicManager.dispose();
  battleSfx.dispose();
  uiSfx.dispose();
  hasPreloadedSfx = false;
  unlockInFlight = null;
};