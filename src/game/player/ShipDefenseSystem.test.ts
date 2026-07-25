import { describe, expect, it } from 'vitest';
import { ShipDefenseSystem } from './ShipDefenseSystem';
import { ShipEnergySystem } from './ShipEnergySystem';

const CONFIG = {
  maxArmor: 100,
  maxShield: 40,
  shieldRechargeDelay: 2,
  shieldRechargeRate: 10,
  shieldRechargeEnergyPerPoint: 0.5,
};

describe('ShipDefenseSystem', () => {
  it('absorbs damage with shields before armor', () => {
    const defense = new ShipDefenseSystem(CONFIG);
    expect(defense.takeDamage(50)).toEqual({ shieldDamage: 40, armorDamage: 10, destroyed: false });
    expect(defense.armor).toBe(90);
    expect(defense.shield).toBe(0);
  });

  it('waits for the recharge delay and consumes energy', () => {
    const defense = new ShipDefenseSystem(CONFIG);
    const energy = new ShipEnergySystem(100, 0, 100);
    defense.takeDamage(20);
    expect(defense.update(1, energy)).toBe(0);
    expect(defense.update(1, energy)).toBe(0);
    expect(defense.update(1, energy)).toBeCloseTo(10);
    expect(energy.current).toBeCloseTo(95);
  });

  it('limits recharge to affordable energy', () => {
    const defense = new ShipDefenseSystem({ ...CONFIG, shieldRechargeDelay: 0 });
    const energy = new ShipEnergySystem(2, 0, 2);
    defense.takeDamage(20);
    expect(defense.update(1, energy)).toBeCloseTo(4);
    expect(energy.current).toBe(0);
  });
});

it('applies recharge only to the portion of a coarse step after the delay expires', () => {
  const defense = new ShipDefenseSystem(CONFIG);
  const energy = new ShipEnergySystem(100, 0, 100);
  defense.takeDamage(20);
  expect(defense.update(2.5, energy)).toBeCloseTo(5);
  expect(defense.shield).toBeCloseTo(25);
});

it.each([30, 60, 120])('recharges equivalently at %i updates per second', (hz) => {
  const defense = new ShipDefenseSystem(CONFIG);
  const energy = new ShipEnergySystem(100, 0, 100);
  defense.takeDamage(20);
  for (let index = 0; index < hz * 3; index += 1) defense.update(1 / hz, energy);
  expect(defense.shield).toBeCloseTo(30, 5);
  expect(energy.current).toBeCloseTo(95, 5);
});
