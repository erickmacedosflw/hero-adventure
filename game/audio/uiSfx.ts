import { Howl, Howler } from 'howler';

const uiSfxConfig = {
  click_in: { file: 'click_in.mp3', volume: 0.5, cooldownMs: 35 },
  click_out: { file: 'click_out.mp3', volume: 0.5, cooldownMs: 50 },
  new_mechanic_modal: { file: 'modal_nova_mecanica.wav', volume: 0.64, cooldownMs: 220 },
} as const;

export type UiSfxEvent = keyof typeof uiSfxConfig;

class UiSfxManager {
  private sounds = new Map<UiSfxEvent, Howl>();
  private lastPlayAt = new Map<UiSfxEvent, number>();
  private hasPreloaded = false;

  private getSound(event: UiSfxEvent) {
    const cached = this.sounds.get(event);
    if (cached) {
      return cached;
    }

    const config = uiSfxConfig[event];
    const sound = new Howl({
      src: [new URL(`./effects/${config.file}`, import.meta.url).href],
      preload: true,
      html5: false,
      volume: config.volume,
      pool: 8,
      onloaderror: (_, error) => {
        console.error(`[UI-SFX] Falha ao carregar ${event}:`, error);
      },
      onplayerror: (_, error) => {
        console.warn(`[UI-SFX] Falha ao reproduzir ${event}:`, error);
      },
    });

    this.sounds.set(event, sound);
    return sound;
  }

  preload() {
    if (this.hasPreloaded) {
      return;
    }

    (Object.keys(uiSfxConfig) as UiSfxEvent[]).forEach((event) => {
      this.getSound(event).load();
    });
    this.hasPreloaded = true;
  }

  async unlock() {
    Howler.autoUnlock = true;
    Howler.mute(false);

    const howlerWithContext = Howler as typeof Howler & { ctx?: AudioContext };
    if (howlerWithContext.ctx && howlerWithContext.ctx.state === 'suspended') {
      try {
        await howlerWithContext.ctx.resume();
      } catch (error) {
        console.warn('[UI-SFX] Nao foi possivel retomar o contexto de audio.', error);
      }
    }
  }

  play(event: UiSfxEvent) {
    const now = Date.now();
    const cooldownMs = uiSfxConfig[event].cooldownMs;
    const lastPlayedAt = this.lastPlayAt.get(event) ?? 0;
    if (now - lastPlayedAt < cooldownMs) {
      return;
    }

    this.lastPlayAt.set(event, now);
    try {
      this.getSound(event).play();
    } catch (error) {
      console.warn(`[UI-SFX] Reproducao bloqueada para ${event}.`, error);
    }
  }

  dispose() {
    this.sounds.forEach((sound) => sound.unload());
    this.sounds.clear();
    this.lastPlayAt.clear();
    this.hasPreloaded = false;
  }
}

export const uiSfx = new UiSfxManager();
