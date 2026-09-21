// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioBus, type MusicName } from '../engine/audio';

/**
 * The battle theme is by far the largest asset in the build. It must not be
 * fetched unless the player actually reaches Arpit, and switching tracks must
 * stop the previous one rather than stacking them.
 */

class FakeAudio {
  static created: FakeAudio[] = [];
  loop = false;
  preload = '';
  volume = 0;
  paused = true;
  plays = 0;

  constructor(readonly src: string) {
    FakeAudio.created.push(this);
  }
  play(): Promise<void> {
    this.plays++;
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  addEventListener(): void {}
}

function sources(): string[] {
  return FakeAudio.created.map((a) => a.src);
}

let bus: AudioBus;

beforeEach(() => {
  FakeAudio.created = [];
  localStorage.clear();
  vi.stubGlobal('Audio', FakeAudio);
  vi.useFakeTimers();
  bus = new AudioBus();
});

/** Runs the crossfade interval to completion. */
function settle(): void {
  vi.advanceTimersByTime(1000);
}

describe('music', () => {
  it('downloads nothing before the first user gesture', () => {
    bus.playMusic('menu');
    expect(sources()).toEqual([]);
  });

  it('starts the requested track once unlocked', () => {
    bus.playMusic('menu');
    bus.unlock();
    settle();
    expect(sources()).toHaveLength(1);
    expect(sources()[0]).toContain('bgm-menu');
    expect(FakeAudio.created[0].loop).toBe(true);
  });

  it('never fetches a track that is not asked for', () => {
    bus.unlock();
    bus.playMusic('gym');
    settle();
    expect(sources().some((s) => s.includes('battle'))).toBe(false);
  });

  it('fetches the battle theme only on reaching the battle', () => {
    bus.unlock();
    bus.playMusic('gym');
    settle();
    const before = sources().length;
    bus.playMusic('battle');
    settle();
    expect(sources()).toHaveLength(before + 1);
    expect(sources().at(-1)).toContain('bgm-battle');
  });

  it('stops the outgoing track instead of layering them', () => {
    bus.unlock();
    bus.playMusic('gym');
    settle();
    const gym = FakeAudio.created[0];
    bus.playMusic('battle');
    settle();
    const battle = FakeAudio.created[1];
    expect(gym.paused).toBe(true);
    expect(battle.paused).toBe(false);
    expect(battle.volume).toBeGreaterThan(0);
  });

  it('reuses an element when returning to a track', () => {
    bus.unlock();
    for (const name of ['gym', 'battle', 'gym'] as MusicName[]) {
      bus.playMusic(name);
      settle();
    }
    expect(sources()).toHaveLength(2);
  });

  it('ignores a request for the track already playing', () => {
    bus.unlock();
    bus.playMusic('gym');
    settle();
    const plays = FakeAudio.created[0].plays;
    bus.playMusic('gym');
    settle();
    expect(FakeAudio.created[0].plays).toBe(plays);
  });
});

describe('mute', () => {
  it('silences and resumes the current track', () => {
    bus.unlock();
    bus.playMusic('gym');
    settle();
    const track = FakeAudio.created[0];

    expect(bus.toggleMute()).toBe(true);
    expect(track.paused).toBe(true);

    expect(bus.toggleMute()).toBe(false);
    expect(track.paused).toBe(false);
    expect(track.volume).toBeGreaterThan(0);
  });

  it('is remembered across sessions', () => {
    bus.toggleMute();
    expect(new AudioBus().isMuted).toBe(true);
  });
});
