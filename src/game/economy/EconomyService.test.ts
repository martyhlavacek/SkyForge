import { describe, expect, it } from 'vitest';
import { createStarterProfile } from '../profile/StarterProfile';
import { EquipmentRegistry, equipmentRegistry } from '../equipment/EquipmentRegistry';
import type { EquipmentDef } from '../../schemas/equipmentSchema';
import { EconomyService } from './EconomyService';

describe('EconomyService', () => {
  function fundedProfile() {
    const profile = createStarterProfile();
    profile.bankedCredits = 10000;
    profile.campaignTier = 1;
    profile.unlockedEquipment.push('weapon_spread', 'utility_credit_magnet');
    return profile;
  }

  it('purchases transactionally and records the ledger', () => {
    const service = new EconomyService(fundedProfile());
    const result = service.purchase('weapon_spread');
    expect(result.success).toBe(true);
    expect(result.profile.inventory.owned.weapon_spread).toBeDefined();
    expect(result.profile.bankedCredits).toBeLessThan(10000);
    expect(result.transaction?.reason).toBe('purchase');
  });

  it('does not mutate state after a failed purchase', () => {
    const profile = fundedProfile();
    profile.bankedCredits = 0;
    const service = new EconomyService(profile);
    const result = service.purchase('weapon_spread');
    expect(result.success).toBe(false);
    expect(result.profile).toEqual(profile);
  });


  it('rejects re-purchase of a non-unique item instead of overwriting ownership', () => {
    const base = structuredClone(equipmentRegistry.get('weapon_spread'));
    if (!base) throw new Error('weapon_spread fixture missing');
    const item: EquipmentDef = { ...base, unique: false };
    class TestRegistry extends EquipmentRegistry {
      override get(id: string): EquipmentDef | undefined {
        return id === item.id ? item : super.get(id);
      }
    }
    const service = new EconomyService(fundedProfile(), new TestRegistry());
    const first = service.purchase(item.id);
    expect(first.success).toBe(true);
    const second = new EconomyService(first.profile, new TestRegistry()).purchase(item.id);
    expect(second.success).toBe(false);
    expect(second.error?.code).toBe('ALREADY_OWNED');
    expect(second.profile.bankedCredits).toBe(first.profile.bankedCredits);
  });

  it('refunds unused equipment at full purchase price', () => {
    const service = new EconomyService(fundedProfile());
    const bought = service.purchase('utility_credit_magnet');
    expect(bought.success).toBe(true);
    const afterBuy = new EconomyService(bought.profile);
    const sold = afterBuy.sell('utility_credit_magnet');
    expect(sold.success).toBe(true);
    expect(sold.transaction?.reason).toBe('refund');
    expect(sold.profile.bankedCredits).toBe(10000);
  });

  it('rejects invalid equip operations without changing the active loadout', () => {
    const profile = fundedProfile();
    profile.inventory.owned.weapon_spread = {
      equipmentId: 'weapon_spread', upgradeLevel: 0, acquiredAtCampaignStep: 1, usedInMission: false,
    };
    const before = structuredClone(profile.loadouts[0]);
    const result = new EconomyService(profile).equip('hull', 'weapon_spread');
    expect(result.success).toBe(false);
    expect(result.profile.loadouts[0]).toEqual(before);
  });
});
