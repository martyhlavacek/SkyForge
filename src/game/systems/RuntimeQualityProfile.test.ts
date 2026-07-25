import { describe, expect, it } from 'vitest';
import { runtimeQualityProfile } from './RuntimeQualityProfile';

describe('runtimeQualityProfile', () => {
  it('uses the desktop projectile budget by default', () => {
    expect(runtimeQualityProfile(false, false)).toEqual({
      maxEnemyBullets: 500,
      particleScale: 1,
    });
  });

  it('reduces bullets and particles for touch-primary play', () => {
    expect(runtimeQualityProfile(true, false)).toEqual({
      maxEnemyBullets: 300,
      particleScale: 0.5,
    });
  });

  it('honors reduced particles on desktop', () => {
    expect(runtimeQualityProfile(false, true).particleScale).toBe(0.5);
  });
});
