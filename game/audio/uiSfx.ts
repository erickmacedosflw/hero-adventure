import { Howl, Howler } from 'howler';

const uiSfxConfig = {
  click_in: { src: new URL('./effects/click_in.mp3', import.meta.url).href, volume: 0.5, cooldownMs: 35 },
  click_out: { src: new URL('./effects/click_out.mp3', import.meta.url).href, volume: 0.5, cooldownMs: 50 },
  new_mechanic_modal: { src: new URL('./effects/modal_nova_mecanica.wav', import.meta.url).href, volume: 0.64, cooldownMs: 220 },
  modal_open: { src: new URL('./system/menu_open.wav', import.meta.url).href, volume: 1, cooldownMs: 120 },
  modal_close: { src: new URL('./system/menu_close.wav', import.meta.url).href, volume: 0.7, cooldownMs: 120 },
  item_equip: { src: new URL('./system/item_equip.wav', import.meta.url).href, volume: 0.66, cooldownMs: 90 },
  item_equip_off: { src: new URL('./system/item_equip_off.wav', import.meta.url).href, volume: 0.66, cooldownMs: 90 },
  evolution_point: { src: new URL('./system/evolution_point.wav', import.meta.url).href, volume: 0.72, cooldownMs: 80 },
  evolution_point_redistribute: { src: new URL('./system/evolution_point_redistribuir.wav', import.meta.url).href, volume: 0.72, cooldownMs: 100 },
  open_cards_evolution: { src: new URL('./system/open_cartas_evolucao.wav', import.meta.url).href, volume: 0.72, cooldownMs: 150 },
  card_select_evolution: { src: new URL('./system/card_select_evolution.wav', import.meta.url).href, volume: 0.74, cooldownMs: 120 },
  shop_sold: { src: new URL('./system/shop_sold.wav', import.meta.url).href, volume: 0.66, cooldownMs: 70 },
  shop_sell: { src: new URL('./system/shop_sell.wav', import.meta.url).href, volume: 0.66, cooldownMs: 70 },
  confirm_hunt_dungeon: { src: new URL('./system/confirm_caca_dungeon.wav', import.meta.url).href, volume: 0.68, cooldownMs: 130 },
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
      src: [config.src],
      preload: true,
      html5: false,
      volume: config.volume,
      pool: 8,
      onloaderror: (_, error) => {
        console.error(`[UI-SFX] Falha ao carregar ${event}:`, error);
      },
      onplayerror: (_, error) => {
        console.warn(`[UI-SFX] Falha ao reproduzir ${event}:`, error);
        sound.once('unlock', () => {
          try {
            sound.play();
          } catch (unlockError) {
            console.warn(`[UI-SFX] Falha ao reproduzir ${event} apos unlock.`, unlockError);
          }
        });
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
