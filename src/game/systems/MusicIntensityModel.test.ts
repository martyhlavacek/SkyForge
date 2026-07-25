import { describe, expect, it } from 'vitest';
import { MusicIntensityModel } from './MusicIntensityModel';

describe('MusicIntensityModel', () => {
  it('calculates bounded threat values', () => {
    expect(
      MusicIntensityModel.threatValue({
        activeEnemies: 100,
        activeEnemyProjectiles: 1000,
        bossActive: false,
        playerHullFraction: 0,
      }),
    ).toBe(1);
    expect(
      MusicIntensityModel.threatValue({
        activeEnemies: 0,
        activeEnemyProjectiles: 0,
        bossActive: false,
        playerHullFraction: 1,
      }),
    ).toBe(0);
  });

  it('forces boss pressure to maximum', () => {
    expect(
      MusicIntensityModel.threatValue({
        activeEnemies: 0,
        activeEnemyProjectiles: 0,
        bossActive: true,
        playerHullFraction: 1,
      }),
    ).toBe(1);
  });

  it('requires dwell time before changing state', () => {
    const model = new MusicIntensityModel(1);
    expect(model.update(0.8, 0.5)).toBeNull();
    expect(model.current).toBe('normal');
    expect(model.update(0.8, 0.5)).toBe('combat');
  });

  it('uses hysteresis to avoid boundary flicker', () => {
    const model = new MusicIntensityModel(0);
    model.update(0.6, 0);
    expect(model.current).toBe('combat');
    expect(model.update(0.5, 1)).toBeNull();
    expect(model.current).toBe('combat');
  });
});
