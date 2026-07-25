import {
  normalizeLevelMusicAssignment,
  type LevelMusicAssignment,
  type MusicAssetRecord,
} from './levelMusicCore';

export interface AudioElementLike {
  src: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  paused: boolean;
  preload: string;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: string, listener: () => void): void;
}

export type MusicUrlResolver = (asset: MusicAssetRecord) => Promise<string> | string;
export type AudioElementFactory = () => AudioElementLike;

export interface Mp3MusicRuntimeOptions {
  resolveUrl: MusicUrlResolver;
  createAudio?: AudioElementFactory;
  onRecoverableError?: (message: string, error?: unknown) => void;
  stepMilliseconds?: number;
}

export interface Mp3MusicRuntimeState {
  trackId: string | null;
  playing: boolean;
  paused: boolean;
  volume: number;
}

export class Mp3MusicRuntime {
  private readonly resolveUrl: MusicUrlResolver;
  private readonly createAudio: AudioElementFactory;
  private readonly onRecoverableError?: (message: string, error?: unknown) => void;
  private readonly stepMilliseconds: number;
  private audio: AudioElementLike | null = null;
  private currentTrackId: string | null = null;
  private targetVolume = 0;
  private generation = 0;

  constructor(options: Mp3MusicRuntimeOptions) {
    this.resolveUrl = options.resolveUrl;
    this.createAudio = options.createAudio ?? (() => new Audio() as unknown as AudioElementLike);
    this.onRecoverableError = options.onRecoverableError;
    this.stepMilliseconds = Math.max(10, options.stepMilliseconds ?? 25);
  }

  async play(asset: MusicAssetRecord, rawAssignment: Partial<LevelMusicAssignment>): Promise<void> {
    const assignment = normalizeLevelMusicAssignment({ ...rawAssignment, trackId: asset.id });

    await this.stop(assignment.fadeSeconds);
    const generation = ++this.generation;

    try {
      const url = await this.resolveUrl(asset);
      if (!url) throw new Error(`No runtime URL resolved for ${asset.id}.`);

      const audio = this.createAudio();
      audio.preload = 'auto';
      audio.src = url;
      audio.loop = assignment.loop;
      audio.volume = assignment.fadeSeconds > 0 ? 0 : assignment.volume;
      audio.currentTime = assignment.startOffsetSeconds;
      this.audio = audio;
      this.currentTrackId = asset.id;
      this.targetVolume = assignment.volume;

      await audio.play();
      if (generation !== this.generation) {
        this.releaseAudio(audio);
        return;
      }
      await this.fade(audio, assignment.volume, assignment.fadeSeconds, generation);
    } catch (error) {
      this.releaseCurrent();
      this.onRecoverableError?.(`Music track ${asset.id} could not be played.`, error);
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  async resume(): Promise<void> {
    try {
      await this.audio?.play();
    } catch (error) {
      this.onRecoverableError?.('Music playback could not resume.', error);
    }
  }

  setVolume(value: number): void {
    this.targetVolume = Math.min(1, Math.max(0, value));
    if (this.audio) this.audio.volume = this.targetVolume;
  }

  async stop(fadeSeconds = 0): Promise<void> {
    const audio = this.audio;
    if (!audio) return;
    const generation = ++this.generation;
    await this.fade(audio, 0, fadeSeconds, generation);
    if (this.audio === audio) this.releaseCurrent();
  }

  dispose(): void {
    ++this.generation;
    this.releaseCurrent();
  }

  getState(): Mp3MusicRuntimeState {
    return {
      trackId: this.currentTrackId,
      playing: Boolean(this.audio && !this.audio.paused),
      paused: Boolean(this.audio?.paused),
      volume: this.audio?.volume ?? 0,
    };
  }

  private async fade(
    audio: AudioElementLike,
    destination: number,
    seconds: number,
    generation: number,
  ): Promise<void> {
    const safeDestination = Math.min(1, Math.max(0, destination));
    if (seconds <= 0) {
      audio.volume = safeDestination;
      return;
    }

    const start = audio.volume;
    const duration = seconds * 1000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < duration) {
      if (generation !== this.generation || this.audio !== audio) return;
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      audio.volume = start + (safeDestination - start) * progress;
      await new Promise<void>((resolve) => setTimeout(resolve, this.stepMilliseconds));
    }
    if (generation === this.generation && this.audio === audio) audio.volume = safeDestination;
  }

  private releaseCurrent(): void {
    if (!this.audio) return;
    this.releaseAudio(this.audio);
    this.audio = null;
    this.currentTrackId = null;
    this.targetVolume = 0;
  }

  private releaseAudio(audio: AudioElementLike): void {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}
