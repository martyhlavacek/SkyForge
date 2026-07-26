import { afterEach, describe, expect, it, vi } from 'vitest';
import { contentRegistry } from './ContentRegistry';
import { audio } from './AudioManager';
import { MusicDirector, normalizeMusicOffset } from './MusicDirector';

class FakeAudioParam {
  value = 1;
  readonly calls: [string, number, number][] = [];
  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push(['set', value, time]);
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push(['linear', value, time]);
  }
  cancelScheduledValues(): void {}
}

class FakeGain {
  gain = new FakeAudioParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeSource {
  buffer: { duration: number } | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  starts: [number, number][] = [];
  stops = 0;
  connect(): void {}
  disconnect(): void {}
  start(when: number, offset: number): void {
    this.starts.push([when, offset]);
  }
  stop(): void {
    this.stops += 1;
  }
}

class FakeMusicContext {
  state: AudioContextState = 'running';
  currentTime = 10;
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  async decodeAudioData(): Promise<{ duration: number }> {
    return { duration: 30 };
  }
}

const audioInternals = audio as unknown as {
  ctx: AudioContext | null;
  musicGain: GainNode | null;
};
const originalContext = audioInternals.ctx;
const originalMusicGain = audioInternals.musicGain;

afterEach(() => {
  audioInternals.ctx = originalContext;
  audioInternals.musicGain = originalMusicGain;
  contentRegistry.music.delete('music-test-track');
  vi.unstubAllGlobals();
});

describe('normalizeMusicOffset', () => {
  it('preserves a non-looping introduction', () => {
    expect(normalizeMusicOffset(2, 8, 24)).toBe(2);
    expect(normalizeMusicOffset(7.99, 8, 24)).toBeCloseTo(7.99);
  });

  it('preserves positions inside the first loop pass', () => {
    expect(normalizeMusicOffset(8, 8, 24)).toBe(8);
    expect(normalizeMusicOffset(23, 8, 24)).toBe(23);
  });

  it('wraps elapsed positions into the loop region', () => {
    expect(normalizeMusicOffset(24, 8, 24)).toBe(8);
    expect(normalizeMusicOffset(29, 8, 24)).toBe(13);
    expect(normalizeMusicOffset(41, 8, 24)).toBe(9);
  });

  it('handles zero-length cues and negative offsets safely', () => {
    expect(normalizeMusicOffset(-5, 0, 0)).toBe(0);
    expect(normalizeMusicOffset(10, 0, 0)).toBe(10);
  });
});

describe('MusicDirector single-track lifecycle', () => {
  it('applies loop, offset, volume, and fade through the music bus', async () => {
    const context = new FakeMusicContext();
    audioInternals.ctx = context as unknown as AudioContext;
    audioInternals.musicGain = new FakeGain() as unknown as GainNode;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
    contentRegistry.music.set('music-test-track', {
      id: 'music-test-track',
      displayName: 'Test MP3',
      bpm: 120,
      beatsPerBar: 4,
      loopStartSeconds: 0,
      loopEndSeconds: 30,
      stems: [
        {
          id: 'full-mix',
          asset: 'data:audio/mpeg;base64,SUQz',
          defaultGain: 1,
          gains: { recovery: 1, normal: 1, combat: 1, critical: 1, boss: 1 },
        },
      ],
      transitions: {},
    });

    const director = new MusicDirector();
    await director.playCue('music-test-track', 'normal', 7.5, {
      loop: false,
      volume: 0.4,
      fadeSeconds: 1,
    });

    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.loop).toBe(false);
    expect(context.sources[0]?.starts[0]?.[1]).toBe(7.5);
    expect(context.gains[0]?.gain.calls).toContainEqual(['set', 0, 10.08]);
    expect(context.gains[0]?.gain.calls).toContainEqual(['linear', 0.4, 11.08]);
    expect(director.getDebugState().cueId).toBe('music-test-track');

    director.pause();
    expect(context.sources[0]?.stops).toBe(1);
    director.resume();
    expect(context.sources).toHaveLength(2);
    director.stop();
    expect(context.sources[1]?.stops).toBe(1);
    expect(director.getDebugState().cueId).toBeNull();
  });

  it('defers playback until the shared audio context is unlocked', async () => {
    audioInternals.ctx = null;
    audioInternals.musicGain = null;
    contentRegistry.music.set('music-test-track', {
      id: 'music-test-track',
      displayName: 'Test MP3',
      bpm: 120,
      beatsPerBar: 4,
      loopStartSeconds: 0,
      loopEndSeconds: 30,
      stems: [
        {
          id: 'full-mix',
          asset: 'data:audio/mpeg;base64,SUQz',
          defaultGain: 1,
          gains: { recovery: 1, normal: 1, combat: 1, critical: 1, boss: 1 },
        },
      ],
      transitions: {},
    });
    const director = new MusicDirector();
    await director.playCue('music-test-track');
    expect(director.getDebugState()).toMatchObject({
      cueId: null,
      pendingCueId: 'music-test-track',
    });
  });
});
