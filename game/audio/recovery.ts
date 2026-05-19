import { Howler } from 'howler';

type HowlerWithContext = typeof Howler & { ctx?: AudioContext; autoSuspend?: boolean };

export interface AudioRuntimeStatus {
  hasUserGesture: boolean;
  isLikelyIos: boolean;
  lastContextState: AudioContextState | 'missing' | 'unknown';
  unlockAttempts: number;
  recoverAttempts: number;
  lastUnlockAt: number | null;
  lastRecoverAt: number | null;
  lastPrimeAt: number | null;
  lastReadyAt: number | null;
}

const detectLikelyIos = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const audioRuntimeStatus: AudioRuntimeStatus = {
  hasUserGesture: false,
  isLikelyIos: detectLikelyIos(),
  lastContextState: 'unknown',
  unlockAttempts: 0,
  recoverAttempts: 0,
  lastUnlockAt: null,
  lastRecoverAt: null,
  lastPrimeAt: null,
  lastReadyAt: null,
};

const getNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const getHowlerContext = () => (Howler as HowlerWithContext).ctx;

const updateContextState = () => {
  const ctx = getHowlerContext();
  audioRuntimeStatus.lastContextState = ctx?.state ?? 'missing';
  return ctx;
};

export const markAudioUserGesture = () => {
  audioRuntimeStatus.hasUserGesture = true;
  audioRuntimeStatus.unlockAttempts += 1;
  audioRuntimeStatus.lastUnlockAt = getNow();
};

export const getAudioRuntimeStatus = (): AudioRuntimeStatus => {
  updateContextState();
  audioRuntimeStatus.isLikelyIos = detectLikelyIos();
  return { ...audioRuntimeStatus };
};

export const isHowlerAudioContextReady = () => updateContextState()?.state === 'running';

const primeContext = (ctx: AudioContext) => {
  try {
    const sampleRate = Number.isFinite(ctx.sampleRate) && ctx.sampleRate > 0 ? ctx.sampleRate : 22050;
    const buffer = ctx.createBuffer(1, 1, sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    source.stop(0);
    audioRuntimeStatus.lastPrimeAt = getNow();
  } catch {
    // noop: priming is best-effort for iOS/PWA audio sessions.
  }
};

export const recoverHowlerAudioContext = async (scope: string) => {
  audioRuntimeStatus.recoverAttempts += 1;
  audioRuntimeStatus.lastRecoverAt = getNow();
  Howler.autoUnlock = true;
  Howler.mute(false);

  const howlerWithContext = Howler as HowlerWithContext;
  if (typeof howlerWithContext.autoSuspend === 'boolean') {
    howlerWithContext.autoSuspend = false;
  }

  const ctx = updateContextState();
  if (!ctx) {
    return true;
  }

  if (ctx.state !== 'running') {
    try {
      await ctx.resume();
    } catch (error) {
      console.warn(`[${scope}] Nao foi possivel retomar o contexto de audio na primeira tentativa.`, error);
    }
  }

  if (ctx.state === 'running') {
    audioRuntimeStatus.lastContextState = ctx.state;
    audioRuntimeStatus.lastReadyAt = getNow();
    primeContext(ctx);
    return true;
  }

  try {
    await ctx.resume();
  } catch (error) {
    console.warn(`[${scope}] Nao foi possivel retomar o contexto de audio na segunda tentativa.`, error);
  }

  if (ctx.state === 'running') {
    audioRuntimeStatus.lastContextState = ctx.state;
    audioRuntimeStatus.lastReadyAt = getNow();
    primeContext(ctx);
    return true;
  }

  audioRuntimeStatus.lastContextState = ctx.state;
  console.warn(`[${scope}] Contexto de audio ainda nao esta pronto: ${ctx.state}.`);
  return false;
};