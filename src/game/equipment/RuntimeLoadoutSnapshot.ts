import type { CampaignProfile, ShipLoadout } from '../../schemas/profileSchema';
import type { DerivedShipStats } from './ShipStatCalculator';
import { shipStatCalculator } from './ShipStatCalculator';
import { loadoutValidator } from './LoadoutValidator';

export interface RuntimeShipLoadoutSnapshot {
  loadout: ShipLoadout;
  derivedStats: DerivedShipStats;
  equipmentUpgradeLevels: Record<string, number>;
}

export function activeLoadout(profile: CampaignProfile): ShipLoadout {
  return profile.loadouts.find((loadout) => loadout.id === profile.activeLoadoutId) ?? profile.loadouts[0];
}

export function buildRuntimeLoadoutSnapshot(profile: CampaignProfile, loadout: ShipLoadout = activeLoadout(profile)): RuntimeShipLoadoutSnapshot {
  const validation = loadoutValidator.validate(loadout, profile);
  if (!validation.valid) throw new Error(validation.errors.map((error) => error.message).join('; '));
  const equipmentIds = [loadout.hullId, loadout.primaryWeaponId, loadout.secondaryWeaponId, loadout.propulsionId, loadout.generatorId, loadout.shieldId, loadout.armorId, ...loadout.utilityIds].filter((id): id is string => Boolean(id));
  return {
    loadout: structuredClone(loadout),
    derivedStats: shipStatCalculator.calculate(loadout, profile),
    equipmentUpgradeLevels: Object.fromEntries(equipmentIds.map((id) => [id, profile.inventory.owned[id]?.upgradeLevel ?? 0])),
  };
}
