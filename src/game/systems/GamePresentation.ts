import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, TEX } from '../config/constants';
import { audio } from './AudioManager';
import type { RuntimeQualityProfile } from './RuntimeQualityProfile';
import { saveData } from './SaveData';

/** Presentation-only feedback kept separate from gameplay state and scoring. */
export class GamePresentation {
  private readonly explosions: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly quality: RuntimeQualityProfile,
  ) {
    this.explosions = scene.add.particles(0, 0, TEX.PARTICLE, {
      speed: { min: 60, max: 180 },
      lifespan: 400,
      scale: { start: 1, end: 0 },
      emitting: false,
    });
    this.explosions.setDepth(DEPTHS.FX);
  }

  explosion(baseCount: number, x: number, y: number): void {
    this.explosions.explode(this.particleCount(baseCount), x, y);
  }
  enemyDestroyed(x: number, y: number): void {
    this.explosion(8, x, y);
    audio.play('explosion');
  }
  bossDestroyed(y: number): void {
    this.explosion(40, GAME_WIDTH / 2, y);
    audio.play('explosion');
  }
  playerDamaged(): void {
    audio.play('playerHit');
    const shake = saveData.settings.screenShake;
    const flash = saveData.settings.flashIntensity;
    if (shake > 0) this.scene.cameras.main.shake(180, 0.008 * shake);
    if (flash > 0)
      this.scene.cameras.main.flash(160, 120 * flash, 20 * flash, 30 * flash);
  }
  pickupCollected(x: number, y: number): void {
    this.explosion(6, x, y - 20);
    audio.play('pickup');
  }
  playerDestroyed(x: number, y: number): void {
    this.explosion(16, x, y);
  }
  showLevelIntro(displayName: string): void {
    const card = this.scene.add
      .text(GAME_WIDTH / 2, 300, displayName.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#e8f0ff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.HUD + 5)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: card,
      alpha: { from: 0, to: 1 },
      duration: 400,
      yoyo: true,
      hold: 900,
      onComplete: () => card.destroy(),
    });
  }

  private particleCount(base: number): number {
    return Math.max(1, Math.round(base * this.quality.particleScale));
  }
}
