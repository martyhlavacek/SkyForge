import Phaser from 'phaser';

export const SCORE_EVENTS = {
  CHANGED: 'score:changed', // (score: number)
} as const;

/**
 * ScoreSystem (Sprint 2.2). Multiplier logic arrives in Sprint 5.5 —
 * addKill() is the single entry point it will hook.
 */
export class ScoreSystem {
  private score = 0;

  constructor(
    private readonly events: Phaser.Events.EventEmitter,
    initialScore = 0,
  ) {
    this.score = Math.max(0, Number.isFinite(initialScore) ? initialScore : 0);
  }

  get value(): number {
    return this.score;
  }

  restore(score: number): void {
    this.score = Math.max(0, Number.isFinite(score) ? score : 0);
    this.events.emit(SCORE_EVENTS.CHANGED, this.score);
  }

  addKill(scoreValue: number): void {
    this.score += scoreValue;
    this.events.emit(SCORE_EVENTS.CHANGED, this.score);
  }
}
