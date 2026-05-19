import { battleSfx } from './sfx';
import { gameMusicManager, type MusicTrackId } from './music';
import { uiSfx } from './uiSfx';
import { getAudioRuntimeStatus, markAudioUserGesture } from './recovery';

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

  if (!unlockInFlight) {
    unlockInFlight = runManagersUnlock().finally(() => {
      unlockInFlight = null;
    });
  }

  const isContextReady = await unlockInFlight;
  preloadUnlockedAudio();

  if (targetMusicTrack && musicEnabled) {
    // iOS exige uma tentativa de play imediatamente apos o gesto para liberar BGM no PWA.
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