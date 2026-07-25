import { contentRegistry } from './ContentRegistry';
import { audio } from './AudioManager';
import { MusicIntensityModel } from './MusicIntensityModel';
import type { MusicCueDef, MusicIntensityState } from '../../schemas/musicSchema';

/**
 * Convert an absolute cue offset into a valid playback position while
 * preserving any non-looping introduction before loopStart.
 */
export function normalizeMusicOffset(
  offset: number,
  loopStart: number,
  loopEnd: number,
): number {
  const safeOffset = Math.max(0, offset);
  const loopLength = loopEnd - loopStart;
  if (loopLength <= 0 || safeOffset < loopEnd) return safeOffset;
  return loopStart + ((safeOffset - loopStart) % loopLength);
}

interface ActiveStem {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export interface MusicDebugState {
  cueId: string | null;
  state: MusicIntensityState;
  pendingCueId: string | null;
  paused: boolean;
  bar: number;
  beat: number;
  contextState: AudioContextState | 'unavailable';
  stemGains: Record<string, number>;
}

/**
 * Adaptive stem player. All buffers use one AudioContext and are started at
 * the same scheduled time, preserving phase alignment across intensity
 * changes. Cue loading is deferred until the browser audio gate unlocks.
 */
class MusicDirector {
  private readonly buffers = new Map<string, AudioBuffer>();
  private active = new Map<string, ActiveStem>();
  private currentCue: MusicCueDef | null = null;
  private pendingCueId: string | null = null;
  private state: MusicIntensityState = 'normal';
  private model = new MusicIntensityModel();
  private startedAt = 0;
  private offset = 0;
  private paused = false;
  private requestToken = 0;
  private pendingOffset = 0;

  constructor() {
    audio.onUnlocked(() => {
      if (this.pendingCueId) void this.playCue(this.pendingCueId, this.state, this.pendingOffset);
    });
  }

  async playCue(
    cueId: string,
    initialState: MusicIntensityState = 'normal',
    initialOffsetSeconds = 0,
  ): Promise<void> {
    const cue = contentRegistry.music.get(cueId);
    if (!cue) {
      console.error(`[MusicDirector] unknown cue "${cueId}"`);
      return;
    }
    this.pendingCueId = cueId;
    this.pendingOffset = Math.max(0, initialOffsetSeconds);
    this.state = initialState;
    this.model.reset(initialState);

    if (cue.stems.length === 0) {
      this.stop();
      this.currentCue = cue;
      this.pendingCueId = null;
      return;
    }
    if (!audio.isUnlocked || !audio.context || !audio.musicDestination) return;

    const token = ++this.requestToken;
    try {
      await Promise.all(cue.stems.map((stem) => this.loadBuffer(stem.asset)));
      if (token !== this.requestToken || this.pendingCueId !== cueId) return;
      this.stopSources();
      this.currentCue = cue;
      this.pendingCueId = null;
      this.offset = normalizeMusicOffset(this.pendingOffset, cue.loopStartSeconds, cue.loopEndSeconds);
      this.pendingOffset = 0;
      this.paused = false;
      this.startSources(this.offset, audio.context.currentTime + 0.08);
    } catch (error) {
      console.error(`[MusicDirector] failed to load cue "${cueId}"`, error);
    }
  }

  updateIntensity(value: number, dt: number): void {
    if (this.state === 'boss') return;
    const changed = this.model.update(value, dt);
    if (changed) this.applyState(changed);
  }

  setState(state: MusicIntensityState, rampSeconds = 0.6): void {
    this.model.force(state);
    this.applyState(state, rampSeconds);
  }

  pause(): void {
    if (this.paused || !this.currentCue || !audio.context) return;
    this.offset = this.currentOffset(audio.context.currentTime);
    this.paused = true;
    this.stopSources();
  }

  resume(): void {
    if (!this.paused || !this.currentCue || !audio.context || !audio.isUnlocked) return;
    this.paused = false;
    this.startSources(this.offset, audio.context.currentTime + 0.06);
  }

  stop(): void {
    this.requestToken++;
    this.pendingCueId = null;
    this.pendingOffset = 0;
    this.stopSources();
    this.currentCue = null;
    this.offset = 0;
    this.paused = false;
    this.state = 'normal';
    this.model.reset();
  }

  getDebugState(): MusicDebugState {
    const ctx = audio.context;
    const cue = this.currentCue;
    let bar = 0;
    let beat = 0;
    if (ctx && cue && cue.stems.length > 0) {
      const seconds = this.paused ? this.offset : this.currentOffset(ctx.currentTime);
      const beatFloat = seconds / (60 / cue.bpm);
      bar = Math.floor(beatFloat / cue.beatsPerBar) + 1;
      beat = Math.floor(beatFloat % cue.beatsPerBar) + 1;
    }
    return {
      cueId: cue?.id ?? null,
      state: this.state,
      pendingCueId: this.pendingCueId,
      paused: this.paused,
      bar,
      beat,
      contextState: ctx?.state ?? 'unavailable',
      stemGains: Object.fromEntries(
        [...this.active].map(([id, stem]) => [id, stem.gain.gain.value]),
      ),
    };
  }

  clearBufferCache(): void {
    this.buffers.clear();
  }

  private async loadBuffer(asset: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(asset);
    if (cached) return cached;
    const ctx = audio.context;
    if (!ctx) throw new Error('audio context is not unlocked');
    const base = import.meta.env.BASE_URL || '/';
    const url = /^(?:data:|https?:)/i.test(asset)
      ? asset
      : new URL(`${base}${asset}`.replace(/\/+/g, '/'), window.location.origin).toString();
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText}: ${url}`);
    const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
    this.buffers.set(asset, decoded);
    return decoded;
  }

  private startSources(offset: number, when: number): void {
    const cue = this.currentCue;
    const ctx = audio.context;
    const destination = audio.musicDestination;
    if (!cue || !ctx || !destination || cue.stems.length === 0) return;

    const normalizedOffset = normalizeMusicOffset(
      offset,
      cue.loopStartSeconds,
      cue.loopEndSeconds,
    );

    for (const stemDef of cue.stems) {
      const buffer = this.buffers.get(stemDef.asset);
      if (!buffer) continue;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = cue.loopStartSeconds;
      source.loopEnd = Math.min(cue.loopEndSeconds, buffer.duration);
      gain.gain.setValueAtTime(stemDef.defaultGain * stemDef.gains[this.state], when);
      source.connect(gain);
      gain.connect(destination);
      source.start(
        when,
        Math.min(normalizedOffset, Math.max(0, buffer.duration - 0.001)),
      );
      this.active.set(stemDef.id, { source, gain });
    }
    this.startedAt = when;
    this.offset = normalizedOffset;
  }

  private applyState(state: MusicIntensityState, rampSeconds = 0.6): void {
    this.state = state;
    const cue = this.currentCue;
    const ctx = audio.context;
    if (!cue || !ctx) return;
    const now = ctx.currentTime;
    for (const stemDef of cue.stems) {
      const stem = this.active.get(stemDef.id);
      if (!stem) continue;
      const target = stemDef.defaultGain * stemDef.gains[state];
      stem.gain.gain.cancelScheduledValues(now);
      stem.gain.gain.setValueAtTime(stem.gain.gain.value, now);
      stem.gain.gain.linearRampToValueAtTime(target, now + Math.max(0.02, rampSeconds));
    }
  }

  private currentOffset(now: number): number {
    const cue = this.currentCue;
    if (!cue) return 0;
    const elapsed = Math.max(0, now - this.startedAt);
    return normalizeMusicOffset(
      this.offset + elapsed,
      cue.loopStartSeconds,
      cue.loopEndSeconds,
    );
  }

  private stopSources(): void {
    for (const stem of this.active.values()) {
      try {
        stem.source.stop();
      } catch {
        // Source may already have ended during scene shutdown.
      }
      stem.source.disconnect();
      stem.gain.disconnect();
    }
    this.active.clear();
  }
}

export const music = new MusicDirector();
