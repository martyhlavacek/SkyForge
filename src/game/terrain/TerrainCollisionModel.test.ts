import { describe, expect, it } from 'vitest';
import {
  corridorBoundsAt,
  pointInsideCorridor,
  resolveCircleInCorridor,
  sweepCircleAgainstRect,
  sweepCircleInCorridor,
} from './TerrainCollisionModel';
import type { TerrainCollisionDef } from '../../schemas/terrainSchema';

const collision: TerrainCollisionDef = {
  formatVersion: '2.0',
  id: 'test',
  mapId: 'map',
  contactDamage: 20,
  lethalContact: false,
  corridor: {
    id: 'route',
    blocksPlayerProjectiles: true,
    blocksEnemyProjectiles: true,
    samples: [
      { worldY: 0, left: 100, right: 440 },
      { worldY: 100, left: 140, right: 400 },
    ],
  },
};

describe('TerrainCollisionModel', () => {
  it('interpolates corridor edges', () => {
    expect(corridorBoundsAt(collision.corridor.samples, 50)).toEqual({
      left: 120,
      right: 420,
    });
  });

  it('separates a circle from either wall', () => {
    expect(resolveCircleInCorridor(collision, 0, 102, 8)).toMatchObject({
      hit: 'left',
      correctedX: 108,
    });
    expect(resolveCircleInCorridor(collision, 0, 438, 8)).toMatchObject({
      hit: 'right',
      correctedX: 432,
    });
  });

  it('checks projectile points with a margin', () => {
    expect(pointInsideCorridor(collision, 50, 130, 4)).toBe(true);
    expect(pointInsideCorridor(collision, 50, 121, 4)).toBe(false);
  });

  it('detects a corridor wall crossed between frame endpoints', () => {
    const hit = sweepCircleInCorridor(
      collision,
      { x: 390, worldY: 0 },
      { x: 390, worldY: 100 },
      20,
      5,
    );
    expect(hit?.hit).toBe('right');
    expect(hit?.t).toBeGreaterThan(0);
    expect(hit?.t).toBeLessThan(1);
  });

  it('detects a fast circle crossing a thin barrier', () => {
    expect(
      sweepCircleAgainstRect(
        { x: 100, y: 0 },
        { x: 100, y: 200 },
        10,
        { x: 60, y: 90, width: 80, height: 8 },
      ),
    ).toBeCloseTo(0.4, 3);
  });

  it('returns null when a swept circle misses a rectangle', () => {
    expect(
      sweepCircleAgainstRect(
        { x: 10, y: 0 },
        { x: 10, y: 200 },
        5,
        { x: 60, y: 90, width: 80, height: 8 },
      ),
    ).toBeNull();
  });
});
