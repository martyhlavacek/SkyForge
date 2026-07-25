import { COLLISION } from '../config/constants';
import { deg2rad } from '../../shared/mathUtils';
import type { ProjectilePatternDef } from '../../schemas/projectilePatternSchema';
import type { Projectile } from '../entities/Projectile';
import type { PoolManager } from './PoolManager';
import { difficulty } from './DifficultyManager';
import { audio } from './AudioManager';

/**
 * Pure pattern math (Sprint 3.3, unit-tested): compute the velocity vector
 * for every projectile in a pattern volley.
 * Convention: aimed=false → angles are offsets from straight DOWN (+Y).
 * aimed=true → angles are offsets from `aimAngleRad` (enemy→player).
 */
export function patternVelocities(
  def: Pick<ProjectilePatternDef, 'angles' | 'aimed' | 'speed'>,
  aimAngleRad: number,
  sweepOffsetDeg = 0,
): { vx: number; vy: number }[] {
  const base = (def.aimed ? aimAngleRad : Math.PI / 2) + deg2rad(sweepOffsetDeg);
  return def.angles.map((deg) => {
    const a = base + deg2rad(deg);
    return { vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed };
  });
}

/** Triangle-wave sweep offset in degrees for a given elapsed time. */
export function sweepOffset(
  sweep: { from: number; to: number; period: number } | undefined,
  t: number,
): number {
  if (!sweep) return 0;
  const half = sweep.period / 2;
  const phase = t % sweep.period;
  const frac = phase < half ? phase / half : 1 - (phase - half) / half;
  return sweep.from + (sweep.to - sweep.from) * frac;
}

/**
 * Per-enemy weapon component (Sprint 3.3). Instantiated on enemy activate
 * from a pattern id; owns its own cooldown. `fireRateMultiplier` (from the
 * movement state, e.g. stop_and_fire) scales the cooldown.
 */
export interface EnemyWeaponSnapshot {
  patternId: string;
  cooldown: number;
  elapsed: number;
}

export class EnemyWeapon {
  private cooldown: number;
  private elapsed = 0;

  constructor(
    private readonly def: ProjectilePatternDef,
    private readonly pool: PoolManager<Projectile>,
    extraFirstShotDelay = 0, // formation member fireDelay (Sprint 4.1)
  ) {
    this.cooldown = def.firstShotDelay + extraFirstShotDelay;
  }

  snapshot(): EnemyWeaponSnapshot {
    return { patternId: this.def.id, cooldown: this.cooldown, elapsed: this.elapsed };
  }

  restore(snapshot: EnemyWeaponSnapshot): void {
    if (snapshot.patternId !== this.def.id) return;
    this.cooldown = snapshot.cooldown;
    this.elapsed = snapshot.elapsed;
  }

  update(
    dt: number,
    originX: number,
    originY: number,
    aimAngleRad: number,
    fireRateMultiplier: number,
    canFire: boolean,
  ): void {
    this.elapsed += dt;
    this.cooldown -= dt;
    if (this.cooldown > 0 || !canFire) return;
    this.cooldown += this.def.cooldown * fireRateMultiplier;

    const sweep = sweepOffset(this.def.angleSweep, this.elapsed);
    const scaled = { ...this.def, speed: difficulty.scaleProjectileSpeed(this.def.speed) };
    audio.play('enemyShot');
    for (const v of patternVelocities(scaled, aimAngleRad, sweep)) {
      const p = this.pool.spawn();
      if (!p) return;
      p.fire({
        x: originX,
        y: originY,
        texture: this.def.projectileTexture,
        vx: v.vx,
        vy: v.vy,
        damage: this.def.damage,
        category: COLLISION.ENEMY_BULLET,
        lifetime: this.def.lifetime,
        circleRadius: 4,
      });
    }
  }
}
