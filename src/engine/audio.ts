/**
 * Sound effects and background music.
 *
 * Effects go through WebAudio so they fire with no latency and can overlap;
 * music is a plain looping <audio> element so it streams rather than sitting
 * decoded in memory.
 *
 * Browsers refuse to start audio until the user has interacted with the page,
 * so everything is armed up front and actually begins on the first keypress.
 */

import MANIFEST from '../content/audioManifest.json';

export type SoundName =
  | 'select' | 'cursor' | 'text' | 'bump' | 'door' | 'panel'
  | 'crate' | 'gate' | 'solved' | 'hit' | 'heal' | 'debuff'
  | 'miss' | 'lowHp' | 'badge';

/**
 * Filenames written by tools/extract_audio.py. It emits mp3 when ffmpeg is
 * available and wav when it is not, so the extension is looked up rather
 * than assumed.
 */
interface AudioManifest extends Partial<Record<SoundName, string>> {
  music?: Partial<Record<MusicName, string>>;
}

const FILES = MANIFEST as AudioManifest;

/** Where each track plays. */
export type MusicName = 'menu' | 'gym' | 'rival' | 'battle';

const SFX_VOLUME = 0.5;
const MUSIC_VOLUME = 0.32;
const MUTE_KEY = 'smt-tech-gym:muted';

export class AudioBus {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  /** One element per track, created the first time that track is needed. */
  private tracks = new Map<MusicName, HTMLAudioElement>();
  private current: MusicName | null = null;
  private fading = 0;
  private unlocked = false;
  private muted = readMuted();
  /** Names that failed to load, so we do not retry or spam the console. */
  private absent = new Set<string>();

  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Fetches and decodes every effect. Resolves even if some are missing, so
   * a partial audio folder degrades to silence rather than breaking the game.
   */
  async load(names: readonly SoundName[], base = 'assets/audio'): Promise<void> {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.muted ? 0 : SFX_VOLUME;
    this.gain.connect(this.ctx.destination);

    await Promise.all(
      names.map(async (name) => {
        const file = FILES[name];
        if (!file) {
          this.absent.add(name);
          return;
        }
        try {
          const res = await fetch(`${base}/${file}`);
          if (!res.ok) throw new Error(String(res.status));
          this.buffers.set(name, await (this.ctx as AudioContext).decodeAudioData(await res.arrayBuffer()));
        } catch {
          this.absent.add(name);
        }
      }),
    );

    if (this.absent.size && import.meta.env.DEV) {
      console.info(`[audio] no file for: ${[...this.absent].join(', ')}`);
    }
  }

  /**
   * Requests a track. Nothing is downloaded until a track is actually asked
   * for, so the battle theme -- much the largest file -- costs nothing unless
   * the player reaches Arpit.
   */
  playMusic(name: MusicName, base = 'assets/audio'): void {
    if (this.current === name) return;
    this.current = name;
    if (this.unlocked) this.switchTo(name, base);
  }

  private track(name: MusicName, base: string): HTMLAudioElement | null {
    const existing = this.tracks.get(name);
    if (existing) return existing;

    const file = FILES.music?.[name];
    if (!file) return null;

    const el = new Audio(`${base}/${file}`);
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    this.tracks.set(name, el);
    return el;
  }

  /** Short crossfade, so scene changes do not pop. */
  private switchTo(name: MusicName, base: string): void {
    const next = this.track(name, base);
    const target = this.muted ? 0 : MUSIC_VOLUME;

    window.clearInterval(this.fading);
    const steps = 12;
    let step = 0;
    const from = new Map(
      [...this.tracks].filter(([key]) => key !== name).map(([key, el]) => [key, el.volume]),
    );

    if (next && !this.muted) void next.play().catch(() => undefined);

    this.fading = window.setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      for (const [key, start] of from) {
        const el = this.tracks.get(key);
        if (!el) continue;
        el.volume = start * (1 - t);
        if (t >= 1) el.pause();
      }
      if (next) next.volume = target * t;
      if (t >= 1) window.clearInterval(this.fading);
    }, 25);
  }

  /**
   * Called on the first real keypress. Until a user gesture, browsers keep
   * the audio context suspended and refuse to play the music element.
   */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    void this.ctx?.resume();
    if (this.current) this.switchTo(this.current, 'assets/audio');
  }

  play(name: SoundName, volume = 1): void {
    if (this.muted || !this.ctx || !this.gain) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    if (volume === 1) {
      source.connect(this.gain);
    } else {
      const trim = this.ctx.createGain();
      trim.gain.value = volume;
      source.connect(trim).connect(this.gain);
    }
    source.start();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    writeMuted(this.muted);
    if (this.gain) this.gain.gain.value = this.muted ? 0 : SFX_VOLUME;

    for (const [name, el] of this.tracks) {
      if (this.muted) {
        el.pause();
        el.volume = 0;
      } else if (name === this.current && this.unlocked) {
        el.volume = MUSIC_VOLUME;
        void el.play().catch(() => undefined);
      }
    }
    return this.muted;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Shared bus; scenes reach for this directly. */
export const audio = new AudioBus();

export const SOUND_NAMES: readonly SoundName[] = [
  'select', 'cursor', 'text', 'bump', 'door', 'panel', 'crate', 'gate', 'solved', 'hit', 'heal', 'debuff', 'miss', 'lowHp', 'badge',
];
