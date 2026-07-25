import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import { Boss } from '../entities/Boss';
import type { EnemyContext } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { audio } from './AudioManager';
import { music } from './MusicDirector';
import { PoolManager } from './PoolManager';

/** Owns the standalone boss entity and every collider attached to it. */
export class BossController {
  private boss: Boss | null = null;
  private colliders: Phaser.Physics.Arcade.Collider[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly playerBullets: PoolManager<Projectile>,
    private readonly missiles: PoolManager<Projectile>,
    private readonly enemyContext: () => EnemyContext,
  ) {}

  get isActive(): boolean {
    return this.boss !== null && !this.boss.isDefeated;
  }
  get isPresent(): boolean {
    return this.boss !== null;
  }
  get definitionId(): string | undefined {
    return this.boss && !this.boss.isDefeated ? this.boss.definitionId : undefined;
  }
  get centerY(): number {
    return this.boss?.centerY ?? 200;
  }

  start(bossId: string, silent = false): boolean {
    this.destroy();
    if (!silent) audio.play('bossWarning');
    music.setState('boss', 0.35);
    const boss = new Boss(this.scene, GAME_WIDTH / 2, -80);
    if (!boss.activate(bossId, this.enemyContext())) {
      boss.destroyVisuals();
      boss.destroy();
      return false;
    }
    this.boss = boss;
    this.colliders = [
      this.createProjectileOverlap(this.playerBullets),
      this.createProjectileOverlap(this.missiles),
    ];
    return true;
  }

  tick(dt: number): void {
    this.boss?.tick(dt);
  }
  forceNextPhase(): void {
    this.boss?.forceNextPhase();
  }
  completeDefeat(): void {
    this.destroy();
  }
  destroy(): void {
    this.destroyColliders();
    if (!this.boss) return;
    this.boss.destroyVisuals();
    this.boss.destroy();
    this.boss = null;
  }

  private createProjectileOverlap(
    pool: PoolManager<Projectile>,
  ): Phaser.Physics.Arcade.Collider {
    return this.scene.physics.add.overlap(pool.group, this.boss!, (a, b) => {
      const boss = this.boss;
      const projectile = (a === boss ? b : a) as Projectile;
      if (!projectile.active || !boss) return;
      const hitPart = boss.hitPart(projectile.x, projectile.y, projectile.damage);
      projectile.deactivate();
      if (!hitPart) boss.takeDamage(projectile.damage);
    });
  }

  private destroyColliders(): void {
    this.colliders.forEach((collider) => collider.destroy());
    this.colliders = [];
  }
}
