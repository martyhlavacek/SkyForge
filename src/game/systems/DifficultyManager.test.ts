import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the registry so the manager reads a known difficulty table.
vi.mock('./ContentRegistry', () => ({
  contentRegistry: {
    difficulty: {
      id: 'difficulty',
      levels: {
        easy: { enemyHealthMultiplier: 0.85, projectileSpeedMultiplier: 0.85, spawnDelayMultiplier: 1.2 },
        normal: { enemyHealthMultiplier: 1.0, projectileSpeedMultiplier: 1.0, spawnDelayMultiplier: 1.0 },
        hard: { enemyHealthMultiplier: 1.15, projectileSpeedMultiplier: 1.2, spawnDelayMultiplier: 0.85 },
      },
    },
  },
}));

import { difficulty } from './DifficultyManager';

afterEach(() => difficulty.set('normal'));

describe('DifficultyManager (Sprint 7.2)', () => {
  it('is neutral on normal', () => {
    difficulty.set('normal');
    expect(difficulty.scaleHealth(100)).toBe(100);
    expect(difficulty.scaleProjectileSpeed(200)).toBe(200);
    expect(difficulty.scaleDelay(1)).toBe(1);
  });

  it('scales all three hooks on hard', () => {
    difficulty.set('hard');
    expect(difficulty.scaleHealth(100)).toBeCloseTo(115);
    expect(difficulty.scaleProjectileSpeed(200)).toBeCloseTo(240);
    expect(difficulty.scaleDelay(1)).toBeCloseTo(0.85);
  });

  it('makes things friendlier on easy', () => {
    difficulty.set('easy');
    expect(difficulty.scaleHealth(100)).toBeCloseTo(85);
    expect(difficulty.scaleProjectileSpeed(200)).toBeCloseTo(170);
    expect(difficulty.scaleDelay(1)).toBeCloseTo(1.2);
  });
});
