/**
 * Shared Web Audio owner (Epoch 9R). The context is created only from a
 * real user gesture. SFX and adaptive music share the same context and
 * category buses so browser policy, pause, visibility, and settings remain
 * coherent.
 */

export type SoundKey =
  | 'shot'
  | 'enemyShot'
  | 'explosion'
  | 'pickup'
  | 'playerHit'
  | 'warning'
  | 'uiMove'
  | 'uiConfirm'
  | 'bossWarning'
  | 'credit'
  | 'purchase'
  | 'upgrade'
  | 'error'
  | 'unlock';

interface SoundDef {
  type: OscillatorType | 'noise';
  freq: number;
  freqEnd?: number;
  duration: number;
  gain: number;
  maxConcurrent: number;
  priority: number;
}

const SOUNDS: Record<SoundKey, SoundDef> = {
  shot: {
    type: 'square',
    freq: 720,
    freqEnd: 480,
    duration: 0.06,
    gain: 0.12,
    maxConcurrent: 3,
    priority: 1,
  },
  enemyShot: {
    type: 'sawtooth',
    freq: 300,
    freqEnd: 200,
    duration: 0.08,
    gain: 0.08,
    maxConcurrent: 3,
    priority: 1,
  },
  explosion: {
    type: 'noise',
    freq: 200,
    duration: 0.28,
    gain: 0.28,
    maxConcurrent: 4,
    priority: 2,
  },
  pickup: {
    type: 'sine',
    freq: 660,
    freqEnd: 990,
    duration: 0.16,
    gain: 0.22,
    maxConcurrent: 2,
    priority: 3,
  },
  playerHit: {
    type: 'sawtooth',
    freq: 180,
    freqEnd: 60,
    duration: 0.32,
    gain: 0.3,
    maxConcurrent: 1,
    priority: 4,
  },
  warning: {
    type: 'sawtooth',
    freq: 440,
    freqEnd: 440,
    duration: 0.2,
    gain: 0.2,
    maxConcurrent: 2,
    priority: 5,
  },
  uiMove: {
    type: 'square',
    freq: 380,
    duration: 0.04,
    gain: 0.1,
    maxConcurrent: 2,
    priority: 1,
  },
  uiConfirm: {
    type: 'square',
    freq: 520,
    freqEnd: 780,
    duration: 0.1,
    gain: 0.14,
    maxConcurrent: 2,
    priority: 2,
  },
  bossWarning: {
    type: 'sawtooth',
    freq: 260,
    freqEnd: 320,
    duration: 0.5,
    gain: 0.26,
    maxConcurrent: 1,
    priority: 6,
  },

  credit: {
    type: 'sine',
    freq: 587,
    freqEnd: 880,
    duration: 0.11,
    gain: 0.16,
    maxConcurrent: 4,
    priority: 2,
  },
  purchase: {
    type: 'square',
    freq: 440,
    freqEnd: 880,
    duration: 0.18,
    gain: 0.16,
    maxConcurrent: 2,
    priority: 3,
  },
  upgrade: {
    type: 'sawtooth',
    freq: 523,
    freqEnd: 1046,
    duration: 0.24,
    gain: 0.14,
    maxConcurrent: 2,
    priority: 4,
  },
  error: {
    type: 'square',
    freq: 220,
    freqEnd: 147,
    duration: 0.16,
    gain: 0.13,
    maxConcurrent: 2,
    priority: 3,
  },
  unlock: {
    type: 'sine',
    freq: 659,
    freqEnd: 1318,
    duration: 0.34,
    gain: 0.18,
    maxConcurrent: 1,
    priority: 5,
  },
};

export interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
}

type UnlockListener = () => void;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private volumes: AudioVolumes = { master: 0.8, music: 0.5, sfx: 0.8 };
  private active = new Map<SoundKey, number>();
  private noiseBuffer: AudioBuffer | null = null;
  private unlockListeners = new Set<UnlockListener>();
  private visibilityWired = false;
  private unlockNotified = false;

  /** Must be called synchronously from a pointer, keyboard, or gamepad event. */
  async unlock(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolumes();
      this.buildNoise();
      this.wireVisibility();
    }

    try {
      if (this.ctx.state !== 'running') await this.ctx.resume();
    } catch {
      return false;
    }
    if (this.ctx.state !== 'running') return false;
    if (!this.unlockNotified) {
      this.unlockNotified = true;
      this.unlockListeners.forEach((listener) => listener());
    }
    return true;
  }

  onUnlocked(listener: UnlockListener): () => void {
    this.unlockListeners.add(listener);
    if (this.isUnlocked) queueMicrotask(listener);
    return () => this.unlockListeners.delete(listener);
  }

  get isUnlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get musicDestination(): AudioNode | null {
    return this.musicGain;
  }

  setVolumes(v: Partial<AudioVolumes>): void {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  getVolumes(): AudioVolumes {
    return { ...this.volumes };
  }

  async suspend(): Promise<void> {
    if (this.ctx?.state === 'running') await this.ctx.suspend();
  }

  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }

  private applyVolumes(): void {
    if (!this.master || !this.musicGain || !this.sfxGain) return;
    this.master.gain.value = this.volumes.master;
    this.musicGain.gain.value = this.volumes.music;
    this.sfxGain.gain.value = this.volumes.sfx;
  }

  private buildNoise(): void {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * 0.3);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  play(key: SoundKey): void {
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    const def = SOUNDS[key];
    const current = this.active.get(key) ?? 0;
    if (current >= def.maxConcurrent) return;

    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(def.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + def.duration);
    gain.connect(this.sfxGain);

    let source: AudioScheduledSourceNode;
    if (def.type === 'noise') {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      source = noise;
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = def.type;
      osc.frequency.setValueAtTime(def.freq, now);
      if (def.freqEnd)
        osc.frequency.exponentialRampToValueAtTime(def.freqEnd, now + def.duration);
      source = osc;
    }
    source.connect(gain);

    this.active.set(key, current + 1);
    source.onended = () => {
      this.active.set(key, Math.max(0, (this.active.get(key) ?? 1) - 1));
      gain.disconnect();
    };
    source.start(now);
    source.stop(now + def.duration);
  }


  playCreditPickup(chainIndex = 0): void {
    const chord = [587.33, 698.46, 880, 1046.5, 1174.66];
    this.playTone(chord[Math.abs(Math.floor(chainIndex)) % chord.length], 0.1, 0.15, 'sine', 1.35);
  }

  private playTone(
    frequency: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
    endRatio = 1,
  ): void {
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(this.sfxGain);
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endRatio !== 1) {
      osc.frequency.exponentialRampToValueAtTime(frequency * endRatio, now + duration);
    }
    osc.connect(gain);
    osc.onended = () => gain.disconnect();
    osc.start(now);
    osc.stop(now + duration);
  }

  private wireVisibility(): void {
    if (this.visibilityWired || typeof document === 'undefined') return;
    this.visibilityWired = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (this.ctx.state === 'suspended') void this.ctx.resume();
    });
  }
}

export const audio = new AudioManager();
