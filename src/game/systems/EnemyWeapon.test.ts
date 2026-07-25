import { describe, expect, it } from 'vitest';
import { EnemyWeapon, patternVelocities } from './EnemyWeapon';
import type { ProjectilePatternDef } from '../../schemas/projectilePatternSchema';

describe('patternVelocities', () => {
  it('computes the five_way_spread vectors (roadmap S3.3 acceptance)', () => {
    const v = patternVelocities(
      { angles: [-30, -15, 0, 15, 30], aimed: false, speed: 180 },
      0, // aim angle irrelevant when aimed=false
    );
    expect(v).toHaveLength(5);
    // Center shot: straight down.
    expect(v[2].vx).toBeCloseTo(0, 5);
    expect(v[2].vy).toBeCloseTo(180, 5);
    // ±30° offsets from straight down.
    expect(v[0].vx).toBeCloseTo(180 * Math.cos(Math.PI / 2 - Math.PI / 6), 5);
    expect(v[0].vy).toBeCloseTo(180 * Math.sin(Math.PI / 2 - Math.PI / 6), 5);
    // Symmetry: outermost pair mirrors in x, matches in y.
    expect(v[4].vx).toBeCloseTo(-v[0].vx, 5);
    expect(v[4].vy).toBeCloseTo(v[0].vy, 5);
    // All shots at pattern speed.
    for (const s of v) expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(180, 5);
  });

  it('offsets aimed patterns from the aim angle', () => {
    const aim = Math.PI; // aiming left
    const v = patternVelocities({ angles: [0], aimed: true, speed: 200 }, aim);
    expect(v[0].vx).toBeCloseTo(-200, 5);
    expect(v[0].vy).toBeCloseTo(0, 5);
  });
});

import { sweepOffset } from './EnemyWeapon';

describe('sweepOffset', () => {
  const sweep = { from: -20, to: 20, period: 4 };

  it('returns 0 when no sweep is defined', () => {
    expect(sweepOffset(undefined, 3)).toBe(0);
  });

  it('starts at `from` at t=0', () => {
    expect(sweepOffset(sweep, 0)).toBeCloseTo(-20);
  });

  it('reaches `to` at the half period', () => {
    expect(sweepOffset(sweep, 2)).toBeCloseTo(20);
  });

  it('returns to `from` at the full period', () => {
    expect(sweepOffset(sweep, 4)).toBeCloseTo(-20);
  });

  it('is at the midpoint a quarter through', () => {
    expect(sweepOffset(sweep, 1)).toBeCloseTo(0);
  });
});

describe('EnemyWeapon Studio snapshots', () => {
  it('restores cooldown and elapsed timing without firing', () => {
    const def = {
      id: 'snapshot_pattern',
      cooldown: 1,
      firstShotDelay: 0.5,
      angles: [0],
      aimed: false,
      speed: 100,
      projectileTexture: 'bullet',
      damage: 1,
      lifetime: 2,
    } as ProjectilePatternDef;
    const pool = { spawn: () => null } as never;
    const weapon = new EnemyWeapon(def, pool);
    weapon.update(0.2, 0, 0, 0, 1, false);
    const saved = weapon.snapshot();
    weapon.update(0.7, 0, 0, 0, 1, false);
    expect(weapon.snapshot()).not.toEqual(saved);
    weapon.restore(saved);
    expect(weapon.snapshot()).toEqual(saved);
  });
});
