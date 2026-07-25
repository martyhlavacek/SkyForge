import { describe, expect, it } from 'vitest';
import { ShipEnergySystem } from './ShipEnergySystem';

describe('ShipEnergySystem', () => {
  it('spends atomically and never becomes negative', () => {
    const energy = new ShipEnergySystem(100, 10, 25);
    expect(energy.spend(20)).toBe(true);
    expect(energy.spend(10)).toBe(false);
    expect(energy.current).toBe(5);
  });

  it('regenerates independently of frame size', () => {
    const a = new ShipEnergySystem(100, 12, 0);
    const b = new ShipEnergySystem(100, 12, 0);
    a.update(1);
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    expect(a.current).toBeCloseTo(b.current, 6);
  });

  it('clamps restoration to capacity', () => {
    const energy = new ShipEnergySystem(50, 0, 45);
    expect(energy.restore(20)).toBe(5);
    expect(energy.fraction).toBe(1);
  });
});

it.each([30, 60, 120])('regenerates equivalently at %i updates per second', (hz) => {
  const energy = new ShipEnergySystem(100, 12, 0);
  for (let index = 0; index < hz; index += 1) energy.update(1 / hz);
  expect(energy.current).toBeCloseTo(12, 6);
});
