import { describe, expect, it } from 'vitest';
import { createStarterProfile } from '../profile/StarterProfile';
import { activeLoadout, buildRuntimeLoadoutSnapshot } from './RuntimeLoadoutSnapshot';
import { shipStatCalculator } from './ShipStatCalculator';

describe('ShipStatCalculator', () => {
  it('produces deterministic, positive starter statistics', () => {
    const profile = createStarterProfile();
    const a = shipStatCalculator.calculate(activeLoadout(profile), profile);
    const b = shipStatCalculator.calculate(activeLoadout(profile), profile);
    expect(a).toEqual(b);
    expect(a.statHash).toMatch(/^[0-9a-f]{8}$/);
    expect(a.maxArmor).toBeGreaterThan(0);
    expect(a.maxEnergy).toBeGreaterThan(0);
    expect(a.maxSpeed).toBeGreaterThan(a.focusedSpeed);
  });

  it('applies owned upgrade modifiers', () => {
    const profile = createStarterProfile();
    const before = shipStatCalculator.calculate(activeLoadout(profile), profile);
    profile.inventory.owned.weapon_pulse.upgradeLevel = 1;
    const after = shipStatCalculator.calculate(activeLoadout(profile), profile);
    expect(after.primaryWeapon.damageMultiplier).toBeGreaterThan(before.primaryWeapon.damageMultiplier);
    expect(after.statHash).not.toBe(before.statHash);
  });

  it('builds an immutable runtime snapshot', () => {
    const profile = createStarterProfile();
    const snapshot = buildRuntimeLoadoutSnapshot(profile);
    profile.loadouts[0].name = 'Changed later';
    expect(snapshot.loadout.name).toBe('Vanguard');
    expect(snapshot.equipmentUpgradeLevels.weapon_pulse).toBe(0);
  });
});
