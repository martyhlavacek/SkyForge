import { describe, expect, it } from 'vitest';
import { EnemySchema } from './enemySchema';

const VALID = {
  id: 'light_fighter',
  displayName: 'Light Fighter',
  sprite: 'tex_enemy_light',
  health: 20,
  collisionDamage: 1,
  scoreValue: 100,
  movementPattern: 'sine_descent',
  weaponPattern: 'single_aimed_shot',
  speed: 130,
  hitbox: { type: 'circle', radius: 14 },
  drops: [],
};

describe('EnemySchema (Sprint 3.1 acceptance)', () => {
  it('parses a valid definition', () => {
    expect(EnemySchema.safeParse(VALID).success).toBe(true);
  });

  it('rejects a missing health field', () => {
    const { health: _health, ...rest } = VALID;
    expect(EnemySchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a negative hitbox radius', () => {
    const bad = { ...VALID, hitbox: { type: 'circle', radius: -5 } };
    expect(EnemySchema.safeParse(bad).success).toBe(false);
  });

  it('defaults drops to an empty array', () => {
    const { drops: _drops, ...rest } = VALID;
    const parsed = EnemySchema.parse(rest);
    expect(parsed.drops).toEqual([]);
  });
});
