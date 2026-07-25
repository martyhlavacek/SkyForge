import type { MusicIntensityState } from '../../schemas/musicSchema';

export interface MusicThreatSample {
  activeEnemies: number;
  activeEnemyProjectiles: number;
  bossActive: boolean;
  playerHullFraction: number;
}

/**
 * Pure adaptive-music state model. Broad threat bands, hysteresis, and a
 * dwell timer prevent rapid layer flicker as enemies enter and leave play.
 */
export class MusicIntensityModel {
  private state: MusicIntensityState = 'normal';
  private candidate: MusicIntensityState | null = null;
  private candidateFor = 0;

  constructor(private readonly dwellSeconds = 1.75) {}

  reset(state: MusicIntensityState = 'normal'): void {
    this.state = state;
    this.candidate = null;
    this.candidateFor = 0;
  }

  get current(): MusicIntensityState {
    return this.state;
  }

  /** Convert runtime pressure into a stable normalized value. */
  static threatValue(sample: MusicThreatSample): number {
    if (sample.bossActive) return 1;
    const enemy = Math.min(0.5, sample.activeEnemies * 0.055);
    const bullets = Math.min(0.35, sample.activeEnemyProjectiles * 0.0045);
    const danger = Math.max(0, 1 - sample.playerHullFraction) * 0.15;
    return Math.max(0, Math.min(1, enemy + bullets + danger));
  }

  update(value: number, dt: number): MusicIntensityState | null {
    const desired = this.desiredWithHysteresis(Math.max(0, Math.min(1, value)));
    if (desired === this.state) {
      this.candidate = null;
      this.candidateFor = 0;
      return null;
    }

    if (desired !== this.candidate) {
      this.candidate = desired;
      this.candidateFor = 0;
    }
    this.candidateFor += Math.max(0, dt);
    if (this.candidateFor < this.dwellSeconds) return null;

    this.state = desired;
    this.candidate = null;
    this.candidateFor = 0;
    return this.state;
  }

  force(state: MusicIntensityState): MusicIntensityState {
    this.state = state;
    this.candidate = null;
    this.candidateFor = 0;
    return state;
  }

  private desiredWithHysteresis(value: number): MusicIntensityState {
    if (this.state === 'boss') return value >= 0.9 ? 'boss' : 'critical';
    switch (this.state) {
      case 'recovery':
        return value >= 0.29 ? 'normal' : 'recovery';
      case 'normal':
        if (value <= 0.19) return 'recovery';
        if (value >= 0.54) return 'combat';
        return 'normal';
      case 'combat':
        if (value <= 0.44) return 'normal';
        if (value >= 0.79) return 'critical';
        return 'combat';
      case 'critical':
        return value <= 0.69 ? 'combat' : 'critical';
    }
  }
}
