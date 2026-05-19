import { describe, expect, it } from 'vitest';
import { createAudioPlaybackLimiter } from '../playbackLimiter';

describe('audio playback limiter', () => {
  it('allows only the configured number of plays inside a short window', () => {
    const limiter = createAudioPlaybackLimiter({ maxPlays: 2, windowMs: 100 });

    expect(limiter.canPlay(1000)).toBe(true);
    expect(limiter.canPlay(1010)).toBe(true);
    expect(limiter.canPlay(1020)).toBe(false);
    expect(limiter.canPlay(1100)).toBe(true);
  });

  it('enforces a minimum interval between plays', () => {
    const limiter = createAudioPlaybackLimiter({ maxPlays: 5, windowMs: 100, minIntervalMs: 20 });

    expect(limiter.canPlay(1000)).toBe(true);
    expect(limiter.canPlay(1010)).toBe(false);
    expect(limiter.canPlay(1020)).toBe(true);
  });

  it('can be reset after disposing an audio manager', () => {
    const limiter = createAudioPlaybackLimiter({ maxPlays: 1, windowMs: 100 });

    expect(limiter.canPlay(1000)).toBe(true);
    expect(limiter.canPlay(1010)).toBe(false);
    limiter.reset();
    expect(limiter.canPlay(1010)).toBe(true);
  });
});