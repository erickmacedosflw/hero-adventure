import { Howler } from 'howler';

type HowlerWithContext = typeof Howler & { ctx?: AudioContext; autoSuspend?: boolean };

const primeContext = (ctx: AudioContext) => {
  try {
    const sampleRate = Number.isFinite(ctx.sampleRate) && ctx.sampleRate > 0 ? ctx.sampleRate : 22050;
    const buffer = ctx.createBuffer(1, 1, sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    source.stop(0);
  } catch {
    // noop: priming is best-effort for iOS/PWA audio sessions.
  }
};

export const recoverHowlerAudioContext = async (scope: string) => {
  Howler.autoUnlock = true;
  Howler.mute(false);

  const howlerWithContext = Howler as HowlerWithContext;
  if (typeof howlerWithContext.autoSuspend === 'boolean') {
    howlerWithContext.autoSuspend = false;
  }

  const ctx = howlerWithContext.ctx;
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
    primeContext(ctx);
    return true;
  }

  try {
    await ctx.resume();
  } catch (error) {
    console.warn(`[${scope}] Nao foi possivel retomar o contexto de audio na segunda tentativa.`, error);
  }

  if (ctx.state === 'running') {
    primeContext(ctx);
    return true;
  }

  console.warn(`[${scope}] Contexto de audio ainda nao esta pronto: ${ctx.state}.`);
  return false;
};