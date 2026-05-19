export interface AudioPlaybackLimiterOptions {
  maxPlays: number;
  windowMs: number;
  minIntervalMs?: number;
}

export interface AudioPlaybackLimiter {
  canPlay: (now?: number) => boolean;
  reset: () => void;
}

const getNow = () => Date.now();

export const createAudioPlaybackLimiter = ({
  maxPlays,
  windowMs,
  minIntervalMs = 0,
}: AudioPlaybackLimiterOptions): AudioPlaybackLimiter => {
  let windowStart = 0;
  let playsInWindow = 0;
  let lastPlayAt = -Infinity;

  const reset = () => {
    windowStart = 0;
    playsInWindow = 0;
    lastPlayAt = -Infinity;
  };

  const canPlay = (now = getNow()) => {
    if (windowStart <= 0 || now - windowStart >= windowMs) {
      windowStart = now;
      playsInWindow = 0;
    }

    if (minIntervalMs > 0 && now - lastPlayAt < minIntervalMs) {
      return false;
    }

    if (playsInWindow >= maxPlays) {
      return false;
    }

    playsInWindow += 1;
    lastPlayAt = now;
    return true;
  };

  return { canPlay, reset };
};