import { Howl } from 'howler';
import { recoverHowlerAudioContext } from './recovery';

const musicTracks = {
  title: {
    src: new URL('../assets/Sounds/Music/Triha_Sonora.mp3', import.meta.url).href,
    volume: 0.42,
  },
  forestDay: {
    src: new URL('../assets/Sounds/Music/Florest_Day.mp3', import.meta.url).href,
    volume: 0.4,
  },
  forestNight: {
    src: new URL('../assets/Sounds/Music/Florest_Night.mp3', import.meta.url).href,
    volume: 0.38,
  },
  dungeon: {
    src: new URL('../assets/Sounds/Music/Dungeon.mp3', import.meta.url).href,
    volume: 0.4,
  },
} as const;

export type MusicTrackId = keyof typeof musicTracks;

const DEFAULT_CROSSFADE_MS = 1400;

class GameMusicManager {
  private tracks = new Map<MusicTrackId, Howl>();
  private currentTrackId: MusicTrackId | null = null;
  private currentHowl: Howl | null = null;
  private fadeTimeoutId: number | null = null;

  private getTrack(trackId: MusicTrackId) {
    const cached = this.tracks.get(trackId);
    if (cached) {
      return cached;
    }

    const next = new Howl({
      src: [musicTracks[trackId].src],
      html5: false,
      loop: true,
      preload: true,
      volume: 0,
      onloaderror: (_, error) => {
        console.error(`[Music] Falha ao carregar ${trackId}:`, error);
      },
      onplayerror: (_, error) => {
        console.error(`[Music] Falha ao reproduzir ${trackId}:`, error);
        next.once('unlock', () => {
          try {
            next.play();
          } catch (unlockError) {
            console.warn(`[Music] Falha ao reproduzir ${trackId} apos unlock.`, unlockError);
          }
        });
      },
    });

    this.tracks.set(trackId, next);
    return next;
  }

  async unlock() {
    return recoverHowlerAudioContext('Music');
  }

  transitionTo(trackId: MusicTrackId, fadeMs = DEFAULT_CROSSFADE_MS) {
    const nextHowl = this.getTrack(trackId);
    const targetVolume = musicTracks[trackId].volume;

    if (this.currentTrackId === trackId && this.currentHowl === nextHowl) {
      if (!nextHowl.playing()) {
        nextHowl.stop();
        nextHowl.volume(0);
        nextHowl.play();
      }
      nextHowl.fade(nextHowl.volume(), targetVolume, fadeMs);
      return;
    }

    if (this.fadeTimeoutId !== null) {
      window.clearTimeout(this.fadeTimeoutId);
      this.fadeTimeoutId = null;
    }

    const previousHowl = this.currentHowl;
    this.currentTrackId = trackId;
    this.currentHowl = nextHowl;

    nextHowl.stop();
    nextHowl.volume(0);
    nextHowl.play();
    nextHowl.fade(0, targetVolume, fadeMs);

    if (previousHowl && previousHowl !== nextHowl) {
      previousHowl.fade(previousHowl.volume(), 0, fadeMs);
      this.fadeTimeoutId = window.setTimeout(() => {
        previousHowl.stop();
        this.fadeTimeoutId = null;
      }, fadeMs + 120);
    }
  }

  stopAll(fadeMs = 500) {
    if (this.fadeTimeoutId !== null) {
      window.clearTimeout(this.fadeTimeoutId);
      this.fadeTimeoutId = null;
    }

    this.currentTrackId = null;
    this.currentHowl = null;

    this.tracks.forEach((track) => {
      if (!track.playing()) {
        track.stop();
        return;
      }

      track.fade(track.volume(), 0, fadeMs);
      window.setTimeout(() => {
        track.stop();
      }, fadeMs + 80);
    });
  }

  dispose() {
    this.stopAll(0);
    this.tracks.forEach((track) => track.unload());
    this.tracks.clear();
  }
}

export const gameMusicManager = new GameMusicManager();

export const isNightTime = (time: string) => {
  const [hoursValue] = time.split(':');
  const hours = Number.parseInt(hoursValue, 10);

  if (Number.isNaN(hours)) {
    return false;
  }

  return hours < 6 || hours >= 18;
};
