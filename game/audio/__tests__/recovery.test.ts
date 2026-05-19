import { beforeEach, describe, expect, it, vi } from 'vitest';

const audioMocks = vi.hoisted(() => {
  const source = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const ctx = {
    state: 'suspended' as AudioContextState,
    sampleRate: 44100,
    destination: {},
    resume: vi.fn(),
    createBuffer: vi.fn(),
    createBufferSource: vi.fn(),
  };
  const howler = {
    autoUnlock: false,
    autoSuspend: true,
    mute: vi.fn(),
    ctx,
  };

  return { ctx, howler, source };
});

vi.mock('howler', () => ({
  Howler: audioMocks.howler,
}));

describe('Howler audio recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioMocks.ctx.state = 'suspended';
    audioMocks.ctx.sampleRate = 44100;
    audioMocks.ctx.resume.mockResolvedValue(undefined);
    audioMocks.ctx.createBuffer.mockReturnValue({});
    audioMocks.ctx.createBufferSource.mockReturnValue(audioMocks.source);
    audioMocks.howler.autoUnlock = false;
    audioMocks.howler.autoSuspend = true;
  });

  it('resumes and primes a suspended context', async () => {
    audioMocks.ctx.resume.mockImplementation(async () => {
      audioMocks.ctx.state = 'running';
    });

    const { getAudioRuntimeStatus, recoverHowlerAudioContext } = await import('../recovery');

    await expect(recoverHowlerAudioContext('Test')).resolves.toBe(true);

    expect(audioMocks.howler.autoUnlock).toBe(true);
    expect(audioMocks.howler.autoSuspend).toBe(false);
    expect(audioMocks.howler.mute).toHaveBeenCalledWith(false);
    expect(audioMocks.ctx.resume).toHaveBeenCalledTimes(1);
    expect(audioMocks.ctx.createBuffer).toHaveBeenCalledWith(1, 1, 44100);
    expect(audioMocks.source.start).toHaveBeenCalledWith(0);
    expect(getAudioRuntimeStatus().lastContextState).toBe('running');
  });

  it('returns false when Safari keeps the context blocked', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { getAudioRuntimeStatus, recoverHowlerAudioContext } = await import('../recovery');

    await expect(recoverHowlerAudioContext('Test')).resolves.toBe(false);

    expect(audioMocks.ctx.resume).toHaveBeenCalledTimes(2);
    expect(getAudioRuntimeStatus().lastContextState).toBe('suspended');

    warnSpy.mockRestore();
  });

  it('records user gesture attempts for unlock diagnostics', async () => {
    const { getAudioRuntimeStatus, markAudioUserGesture } = await import('../recovery');

    markAudioUserGesture();

    const status = getAudioRuntimeStatus();
    expect(status.hasUserGesture).toBe(true);
    expect(status.lastUnlockAt).toEqual(expect.any(Number));
  });
});