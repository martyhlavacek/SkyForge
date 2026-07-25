import type { CampaignProfile, ShipLoadout } from '../../schemas/profileSchema';

export const STARTER_EQUIPMENT_IDS = [
  'hull_vanguard',
  'weapon_pulse',
  'secondary_missile',
  'propulsion_balanced',
  'generator_standard',
  'shield_standard',
  'armor_light',
] as const;

export const STARTER_LOADOUT: ShipLoadout = {
  id: 'loadout_starter',
  name: 'Vanguard',
  hullId: 'hull_vanguard',
  primaryWeaponId: 'weapon_pulse',
  secondaryWeaponId: 'secondary_missile',
  propulsionId: 'propulsion_balanced',
  generatorId: 'generator_standard',
  shieldId: 'shield_standard',
  armorId: 'armor_light',
  utilityIds: [],
};

function profileId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}`;
}

export function createStarterProfile(): CampaignProfile {
  const owned = Object.fromEntries(
    STARTER_EQUIPMENT_IDS.map((equipmentId) => [
      equipmentId,
      {
        equipmentId,
        upgradeLevel: 0,
        acquiredAtCampaignStep: 0,
        usedInMission: false,
      },
    ]),
  );
  return {
    profileId: profileId(),
    bankedCredits: 0,
    campaignTier: 0,
    completedMissions: [],
    unlockedEquipment: [...STARTER_EQUIPMENT_IDS],
    inventory: { owned },
    loadouts: [structuredClone(STARTER_LOADOUT)],
    activeLoadoutId: STARTER_LOADOUT.id,
    missionRecords: {},
    processedSettlementIds: [],
    recentLedger: [],
  };
}
