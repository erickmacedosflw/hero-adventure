import { Howl, Howler } from 'howler';

const SFX_COOLDOWN_MS = 65;

const sfxConfig = {
  attack_weapon_impact: { file: 'dmg_arma.wav', volume: 0.62, cooldownMs: 35, randomRateRange: [0.88, 1.16] as const },
  attack_unarmed_or_magic_impact: { file: 'dmg_soco.wav', volume: 0.62, cooldownMs: 35, randomRateRange: [0.86, 1.16] as const },
  attack_weapon_swing: { file: 'atk_arma.wav', volume: 0.56, cooldownMs: 30, randomRateRange: [0.9, 1.2] as const },
  attack_unarmed_swing: { file: 'atk_soco.wav', volume: 0.56, cooldownMs: 30, randomRateRange: [0.88, 1.2] as const },
  movement_armed: { file: 'desvio.wav', volume: 0.52, cooldownMs: 120 },
  movement_unarmed: { file: 'dash_normal.wav', volume: 0.52, cooldownMs: 120 },
  evade: { file: 'desvio.wav', volume: 0.58, cooldownMs: 45 },
  defended_hit: { file: 'dmg_defesa.wav', volume: 0.62, cooldownMs: 35, randomRateRange: [0.84, 1.12] as const },
  defense_use: { file: 'defense.mp3', volume: 0.58, cooldownMs: 90, seekSeconds: 0.8, randomRateRange: [0.86, 1.14] as const },
  heal: { file: 'effect_cure.wav', volume: 0.6, cooldownMs: 40 },
  death: { file: 'btl_dead1.wav', volume: 0.68, cooldownMs: 120 },
  enemy_steal_success: { file: 'roubo_efetuado.wav', volume: 0.66, cooldownMs: 70 },
} as const;

export type BattleSfxEvent = keyof typeof sfxConfig;

export interface BattleSfxPayload {
  attackKind?: 'physical' | 'magic';
  attackerStyle?: 'weapon' | 'unarmed';
  defended?: boolean;
  source?: 'hero' | 'enemy';
}

class BattleSfxManager {
  private sounds = new Map<BattleSfxEvent, Howl>();
  private lastPlayAt = new Map<BattleSfxEvent, number>();
  private hasPreloaded = false;

  private getSound(event: BattleSfxEvent) {
    const cached = this.sounds.get(event);
    if (cached) {
      return cached;
    }

    const config = sfxConfig[event];
    const sound = new Howl({
      src: [new URL(`./effects/${config.file}`, import.meta.url).href],
      preload: true,
      html5: false,
      volume: config.volume,
      pool: 10,
      onloaderror: (_, error) => {
        console.error(`[SFX] Falha ao carregar ${event}:`, error);
      },
      onplayerror: (_, error) => {
        console.warn(`[SFX] Falha ao reproduzir ${event}:`, error);
      },
    });

    this.sounds.set(event, sound);
    return sound;
  }

  preload() {
    if (this.hasPreloaded) {
      return;
    }

    (Object.keys(sfxConfig) as BattleSfxEvent[]).forEach((event) => {
      const sound = this.getSound(event);
      sound.load();
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
        console.warn('[SFX] Nao foi possivel retomar o contexto de audio.', error);
      }
    }
  }

  private resolveRate(event: BattleSfxEvent, payload?: BattleSfxPayload) {
    const config = sfxConfig[event];
    if (!config.randomRateRange) {
      return 1;
    }

    const [minRate, maxRate] = config.randomRateRange;
    const baseRandomRate = minRate + (Math.random() * (maxRate - minRate));

    // Creates stronger identity: hero brighter, enemy heavier.
    if (payload?.source === 'hero') {
      return Math.min(1.26, baseRandomRate + 0.07);
    }
    if (payload?.source === 'enemy') {
      return Math.max(0.78, baseRandomRate - 0.08);
    }

    return baseRandomRate;
  }

  play(event: BattleSfxEvent, _payload?: BattleSfxPayload) {
    const now = Date.now();
    const config = sfxConfig[event];
    const cooldownMs = config.cooldownMs ?? SFX_COOLDOWN_MS;
    const lastPlayedAt = this.lastPlayAt.get(event) ?? 0;
    if (now - lastPlayedAt < cooldownMs) {
      return;
    }

    this.lastPlayAt.set(event, now);

    const sound = this.getSound(event);
    try {
      const playId = sound.play();
      sound.rate(this.resolveRate(event, _payload), playId);
      if (typeof config.seekSeconds === 'number' && Number.isFinite(config.seekSeconds) && config.seekSeconds > 0) {
        sound.seek(config.seekSeconds, playId);
      }
    } catch (error) {
      console.warn(`[SFX] Reproducao bloqueada para ${event}.`, error);
    }
  }

  dispose() {
    this.sounds.forEach((sound) => sound.unload());
    this.sounds.clear();
    this.lastPlayAt.clear();
    this.hasPreloaded = false;
  }
}

export const battleSfx = new BattleSfxManager();
