import { describe, expect, it } from 'vitest';
import { createStarterProfile } from '../profile/StarterProfile';
import { MissionEconomy } from './MissionEconomy';

describe('MissionEconomy', () => {
  it('claims each reward exactly once', () => {
    const economy = new MissionEconomy('run-a');
    expect(economy.claim({ rewardId: 'e:1', amount: 50, category: 'enemy' })).toBe(true);
    expect(economy.claim({ rewardId: 'e:1', amount: 50, category: 'enemy' })).toBe(false);
    expect(economy.totalEscrow).toBe(50);
  });

  it('protects checkpoint credits and rolls back later claims', () => {
    const economy = new MissionEconomy('run-a');
    economy.claim({ rewardId: 'e:1', amount: 50, category: 'enemy' });
    economy.captureCheckpoint();
    economy.claim({ rewardId: 'e:2', amount: 75, category: 'enemy' });
    economy.retryFromCheckpoint();
    expect(economy.protectedCredits).toBe(50);
    expect(economy.atRiskCredits).toBe(0);
    expect(economy.claim({ rewardId: 'e:2', amount: 75, category: 'enemy' })).toBe(true);
  });

  it('settles once, applies difficulty bonus, and unlocks tier-one equipment', () => {
    const economy = new MissionEconomy('run-a');
    economy.claim({ rewardId: 'boss', amount: 1000, category: 'boss' });
    const profile = createStarterProfile();
    const first = economy.settle(profile, 'level_01', 'hard', 1000);
    expect(first.breakdown.totalBanked).toBe(2500);
    expect(first.profile.bankedCredits).toBe(2500);
    expect(first.profile.campaignTier).toBe(1);
    expect(first.profile.unlockedEquipment).toContain('weapon_spread');
    const duplicate = economy.settle(first.profile, 'level_01', 'hard', 1000);
    expect(duplicate.alreadyProcessed).toBe(true);
    expect(duplicate.profile.bankedCredits).toBe(2500);
  });

  it('restores escrow and claims from a snapshot', () => {
    const economy = new MissionEconomy('run-a');
    economy.claim({ rewardId: 'pickup:1', amount: 20, category: 'pickup' });
    const restored = MissionEconomy.restore(economy.snapshot(), 'run-a');
    expect(restored.totalEscrow).toBe(20);
    expect(restored.claim({ rewardId: 'pickup:1', amount: 20, category: 'pickup' })).toBe(false);
  });
});
