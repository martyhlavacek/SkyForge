import { describe, expect, it } from 'vitest';
import { createStarterProfile } from '../profile/StarterProfile';
import { activeLoadout } from './RuntimeLoadoutSnapshot';
import { loadoutValidator } from './LoadoutValidator';

function ownedEverything() {
  const profile = createStarterProfile();
  for (const id of ['hull_interceptor', 'weapon_rail', 'generator_flux', 'utility_credit_magnet']) {
    profile.unlockedEquipment.push(id);
    profile.inventory.owned[id] = {
      equipmentId: id,
      upgradeLevel: 0,
      acquiredAtCampaignStep: 1,
      usedInMission: false,
    };
  }
  return profile;
}

describe('LoadoutValidator', () => {
  it('accepts the starter loadout', () => {
    const profile = createStarterProfile();
    expect(loadoutValidator.validate(activeLoadout(profile), profile)).toMatchObject({ valid: true });
  });

  it('rejects equipment that is not owned', () => {
    const profile = createStarterProfile();
    const loadout = structuredClone(activeLoadout(profile));
    loadout.primaryWeaponId = 'weapon_spread';
    const result = loadoutValidator.validate(loadout, profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'NOT_OWNED')).toBe(true);
  });

  it('reports incompatible hardpoints', () => {
    const profile = ownedEverything();
    const loadout = structuredClone(activeLoadout(profile));
    loadout.hullId = 'hull_interceptor';
    loadout.generatorId = 'generator_flux';
    loadout.primaryWeaponId = 'weapon_rail';
    const result = loadoutValidator.validate(loadout, profile);
    expect(result.errors.some((error) => error.code === 'INCOMPATIBLE_SLOT')).toBe(true);
  });

  it('rejects more utilities than the hull supports', () => {
    const profile = ownedEverything();
    const loadout = structuredClone(activeLoadout(profile));
    loadout.utilityIds = ['utility_credit_magnet', 'utility_credit_magnet'];
    const result = loadoutValidator.validate(loadout, profile);
    expect(result.errors.some((error) => error.code === 'UTILITY_SLOT_EXCEEDED')).toBe(true);
    expect(result.errors.some((error) => error.code === 'DUPLICATE_UNIQUE_ITEM')).toBe(true);
  });
});
