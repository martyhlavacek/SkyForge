import type { CampaignProfile } from '../../schemas/profileSchema';
import type { EquipmentDef } from '../../schemas/equipmentSchema';
import { equipmentRegistry, type EquipmentRegistry } from '../equipment/EquipmentRegistry';

function unlockedByRequirement(item: EquipmentDef, profile: CampaignProfile): boolean {
  const req = item.unlockRequirement;
  if (!req) return item.tier === 0;
  switch (req.type) {
    case 'campaignTier':
      return profile.campaignTier >= req.tier;
    case 'missionComplete':
      return profile.completedMissions.includes(req.missionId);
    case 'bossDefeated':
      return profile.completedMissions.includes(req.bossId) || profile.completedMissions.includes('level_01');
    case 'optionalObjective':
    case 'discovery':
      return false;
  }
}

export class ProgressionService {
  constructor(private readonly registry: EquipmentRegistry = equipmentRegistry) {}

  applyMissionCompletion(profile: CampaignProfile, missionId: string): CampaignProfile {
    const next = structuredClone(profile);
    if (!next.completedMissions.includes(missionId)) next.completedMissions.push(missionId);
    if (missionId === 'level_01') next.campaignTier = Math.max(next.campaignTier, 1);
    for (const item of this.registry.all()) {
      if (unlockedByRequirement(item, next) && !next.unlockedEquipment.includes(item.id)) {
        next.unlockedEquipment.push(item.id);
      }
    }
    next.unlockedEquipment.sort();
    return next;
  }
}

export const progression = new ProgressionService();
