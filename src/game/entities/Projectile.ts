import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { gameTime } from '../systems/GameTime';
import { deg2rad, steerAngle } from '../../shared/mathUtils';

export interface ProjectileStudioSnapshot {
  x: number;
  y: number;
  texture: string;
  vx: number;
  vy: number;
  damage: number;
  category: number;
  lifetime: number;
  circleRadius?: number;
  rotation: number;
  homing?: {
    turnRateDegPerSec: number;
    acquireDelay: number;
    age: number;
  };
}

export interface ProjectileFireConfig {
  x: number;
  y: number;
  texture: string;
  vx: number;
  vy: number;
  damage: number;
  category: number; // COLLISION.* bitmask
  lifetime: number; // seconds
  circleRadius?: number; // optional circular body
  homing?: {
    turnRateDegPerSec: number;
    acquireDelay: number;
    /** Returns nearest active enemy position, or null. Set by WeaponSystem. */
    findTarget: () => { x: number; y: number } | null;
  };
}

/** Off-screen margin before deactivation. */
const OFFSCREEN = 64;

/**
 * Pooled projectile (Sprint 1.3). Never constructed/destroyed during play —
 * always spawn via PoolManager and recycle with deactivate().
 */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage = 0;
  category = 0;
  private lifetime = 0;
  private speed = 0;
  private circleRadius: number | undefined;
  private homing: ProjectileFireConfig['homing'] | undefined;
  private homingAge = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '__DEFAULT');
    this.setDepth(DEPTHS.PROJECTILES);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  fire(cfg: ProjectileFireConfig): void {
    this.setTexture(cfg.texture);
    this.setPosition(cfg.x, cfg.y);
    this.setActive(true);
    this.setVisible(true);

    const body = this.arcadeBody;
    body.enable = true;
    body.reset(cfg.x, cfg.y);
    if (cfg.circleRadius !== undefined) {
      body.setCircle(
        cfg.circleRadius,
        this.width / 2 - cfg.circleRadius,
        this.height / 2 - cfg.circleRadius,
      );
    } else {
      body.setSize(this.width, this.height, true);
    }
    body.setVelocity(cfg.vx, cfg.vy);

    this.damage = cfg.damage;
    this.category = cfg.category;
    this.circleRadius = cfg.circleRadius;
    this.lifetime = cfg.lifetime;
    this.speed = Math.hypot(cfg.vx, cfg.vy);
    this.homing = cfg.homing;
    this.homingAge = 0;
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    const body = this.arcadeBody;
    body.stop();
    body.enable = false; // inactive projectiles never join collision checks
  }

  studioSnapshot(): ProjectileStudioSnapshot | null {
    if (!this.active) return null;
    return {
      x: this.x,
      y: this.y,
      texture: this.texture.key,
      vx: this.arcadeBody.velocity.x,
      vy: this.arcadeBody.velocity.y,
      damage: this.damage,
      category: this.category,
      lifetime: this.lifetime,
      circleRadius: this.circleRadius,
      rotation: this.rotation,
      homing: this.homing
        ? {
            turnRateDegPerSec: this.homing.turnRateDegPerSec,
            acquireDelay: this.homing.acquireDelay,
            age: this.homingAge,
          }
        : undefined,
    };
  }

  restoreStudioSnapshot(
    snapshot: ProjectileStudioSnapshot,
    findTarget: () => { x: number; y: number } | null = () => null,
  ): void {
    this.fire({
      x: snapshot.x,
      y: snapshot.y,
      texture: snapshot.texture,
      vx: snapshot.vx,
      vy: snapshot.vy,
      damage: snapshot.damage,
      category: snapshot.category,
      lifetime: snapshot.lifetime,
      circleRadius: snapshot.circleRadius,
      homing: snapshot.homing
        ? {
            turnRateDegPerSec: snapshot.homing.turnRateDegPerSec,
            acquireDelay: snapshot.homing.acquireDelay,
            findTarget,
          }
        : undefined,
    });
    this.homingAge = snapshot.homing?.age ?? 0;
    this.setRotation(snapshot.rotation);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    const dt = (delta / 1000) * gameTime.scale;

    // Homing steer (S5.4): after acquireDelay, bend velocity toward the
    // nearest enemy by at most turnRate*dt. No target → fly straight.
    if (this.homing) {
      this.homingAge += dt;
      if (this.homingAge >= this.homing.acquireDelay) {
        const target = this.homing.findTarget();
        if (target) {
          const body = this.arcadeBody;
          const cur = Math.atan2(body.velocity.y, body.velocity.x);
          const want = Math.atan2(target.y - this.y, target.x - this.x);
          const maxDelta = deg2rad(this.homing.turnRateDegPerSec) * dt;
          const next = steerAngle(cur, want, maxDelta);
          body.setVelocity(Math.cos(next) * this.speed, Math.sin(next) * this.speed);
          this.setRotation(next + Math.PI / 2);
        }
      }
    }

    this.lifetime -= dt;
    const off =
      this.x < -OFFSCREEN ||
      this.x > GAME_WIDTH + OFFSCREEN ||
      this.y < -OFFSCREEN ||
      this.y > GAME_HEIGHT + OFFSCREEN;

    if (this.lifetime <= 0 || off) this.deactivate();
  }
}
