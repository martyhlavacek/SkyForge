import type { CampaignProfile, CreditTransaction, ShipLoadout } from '../../schemas/profileSchema';
import type { EquipmentCategory } from '../../schemas/equipmentSchema';
import { equipmentRegistry, type EquipmentRegistry } from '../equipment/EquipmentRegistry';
import { loadoutValidator, type LoadoutValidator } from '../equipment/LoadoutValidator';
import { transactionId } from './CreditLedger';

export type EconomyErrorCode =
  | 'UNKNOWN_ITEM'
  | 'LOCKED'
  | 'ALREADY_OWNED'
  | 'NOT_OWNED'
  | 'INSUFFICIENT_CREDITS'
  | 'EQUIPPED_ITEM'
  | 'STARTER_ITEM'
  | 'MAX_UPGRADE'
  | 'INVALID_LOADOUT';

export interface EconomyResult {
  success: boolean;
  error?: { code: EconomyErrorCode; message: string };
  transaction?: CreditTransaction;
  profile: CampaignProfile;
}

const STARTER_PROTECTED = new Set([
  'hull_vanguard',
  'weapon_pulse',
  'secondary_missile',
  'propulsion_balanced',
  'generator_standard',
  'shield_standard',
  'armor_light',
]);

function activeLoadout(profile: CampaignProfile): ShipLoadout {
  return profile.loadouts.find((loadout) => loadout.id === profile.activeLoadoutId) ?? profile.loadouts[0];
}

function equipmentIds(loadout: ShipLoadout): string[] {
  return [
    loadout.hullId,
    loadout.primaryWeaponId,
    loadout.secondaryWeaponId,
    loadout.propulsionId,
    loadout.generatorId,
    loadout.shieldId,
    loadout.armorId,
    ...loadout.utilityIds,
  ].filter((id): id is string => Boolean(id));
}

function ledger(next: CampaignProfile, transaction: CreditTransaction): void {
  next.recentLedger.push(transaction);
  next.recentLedger = next.recentLedger.slice(-100);
}

export class EconomyService {
  private state: CampaignProfile;

  constructor(
    profile: CampaignProfile,
    private readonly registry: EquipmentRegistry = equipmentRegistry,
    private readonly validator: LoadoutValidator = loadoutValidator,
  ) {
    this.state = structuredClone(profile);
  }

  get profile(): CampaignProfile {
    return structuredClone(this.state);
  }

  purchase(equipmentId: string): EconomyResult {
    const item = this.registry.get(equipmentId);
    if (!item) return this.fail('UNKNOWN_ITEM', `Unknown equipment: ${equipmentId}`);
    if (!this.state.unlockedEquipment.includes(item.id)) return this.fail('LOCKED', `${item.displayName} is locked`);
    // The profile inventory stores one record per equipment ID and has no quantity field.
    // Re-purchase must therefore be rejected for both unique and non-unique definitions.
    if (this.state.inventory.owned[item.id])
      return this.fail('ALREADY_OWNED', `${item.displayName} is already owned`);
    if (this.state.bankedCredits < item.purchaseCost) return this.fail('INSUFFICIENT_CREDITS', `Need ${item.purchaseCost - this.state.bankedCredits} more credits`);

    const next = structuredClone(this.state);
    next.bankedCredits -= item.purchaseCost;
    next.inventory.owned[item.id] = {
      equipmentId: item.id,
      upgradeLevel: 0,
      acquiredAtCampaignStep: next.completedMissions.length,
      usedInMission: false,
    };
    const transaction: CreditTransaction = {
      id: transactionId('purchase'),
      timestamp: Date.now(),
      amount: -item.purchaseCost,
      reason: 'purchase',
      sourceId: item.id,
      balanceAfter: next.bankedCredits,
    };
    ledger(next, transaction);
    this.state = next;
    return { success: true, transaction, profile: this.profile };
  }

  sell(equipmentId: string): EconomyResult {
    const item = this.registry.get(equipmentId);
    const owned = this.state.inventory.owned[equipmentId];
    if (!item || !owned) return this.fail('NOT_OWNED', 'Equipment is not owned');
    if (STARTER_PROTECTED.has(equipmentId)) return this.fail('STARTER_ITEM', 'Starter equipment cannot be sold');
    if (this.state.loadouts.some((loadout) => equipmentIds(loadout).includes(equipmentId))) {
      return this.fail('EQUIPPED_ITEM', `${item.displayName} is used by a saved loadout`);
    }
    const refund = owned.usedInMission ? Math.floor(item.purchaseCost * item.resaleRate) : item.purchaseCost;
    const next = structuredClone(this.state);
    delete next.inventory.owned[equipmentId];
    next.bankedCredits += refund;
    const transaction: CreditTransaction = {
      id: transactionId(owned.usedInMission ? 'sale' : 'refund'),
      timestamp: Date.now(),
      amount: refund,
      reason: owned.usedInMission ? 'sale' : 'refund',
      sourceId: equipmentId,
      balanceAfter: next.bankedCredits,
    };
    ledger(next, transaction);
    this.state = next;
    return { success: true, transaction, profile: this.profile };
  }

  upgrade(equipmentId: string): EconomyResult {
    const item = this.registry.get(equipmentId);
    const owned = this.state.inventory.owned[equipmentId];
    if (!item || !owned) return this.fail('NOT_OWNED', 'Equipment is not owned');
    const upgrade = item.upgradeLevels[owned.upgradeLevel];
    if (!upgrade) return this.fail('MAX_UPGRADE', `${item.displayName} is fully upgraded`);
    if (this.state.bankedCredits < upgrade.cost) return this.fail('INSUFFICIENT_CREDITS', `Need ${upgrade.cost - this.state.bankedCredits} more credits`);
    const next = structuredClone(this.state);
    next.bankedCredits -= upgrade.cost;
    next.inventory.owned[equipmentId].upgradeLevel += 1;
    const transaction: CreditTransaction = {
      id: transactionId('upgrade'),
      timestamp: Date.now(),
      amount: -upgrade.cost,
      reason: 'upgrade',
      sourceId: equipmentId,
      balanceAfter: next.bankedCredits,
    };
    ledger(next, transaction);
    this.state = next;
    return { success: true, transaction, profile: this.profile };
  }

  equip(category: EquipmentCategory, equipmentId: string, utilityIndex = 0): EconomyResult {
    const item = this.registry.get(equipmentId);
    if (!item || item.category !== category) return this.fail('UNKNOWN_ITEM', 'Equipment category mismatch');
    if (!this.state.inventory.owned[equipmentId]) return this.fail('NOT_OWNED', `${item.displayName} is not owned`);
    const next = structuredClone(this.state);
    const loadout = activeLoadout(next);
    switch (category) {
      case 'hull': loadout.hullId = equipmentId; break;
      case 'primaryWeapon': loadout.primaryWeaponId = equipmentId; break;
      case 'secondaryWeapon': loadout.secondaryWeaponId = equipmentId; break;
      case 'propulsion': loadout.propulsionId = equipmentId; break;
      case 'generator': loadout.generatorId = equipmentId; break;
      case 'shield': loadout.shieldId = equipmentId; break;
      case 'armor': loadout.armorId = equipmentId; break;
      case 'utility': {
        const utilities = [...loadout.utilityIds];
        utilities[utilityIndex] = equipmentId;
        loadout.utilityIds = utilities.filter(Boolean);
        break;
      }
    }
    const validation = this.validator.validate(loadout, next);
    if (!validation.valid) return this.fail('INVALID_LOADOUT', validation.errors[0]?.message ?? 'Invalid loadout');
    this.state = next;
    return { success: true, profile: this.profile };
  }

  markActiveLoadoutUsed(): CampaignProfile {
    const next = structuredClone(this.state);
    for (const id of equipmentIds(activeLoadout(next))) {
      const owned = next.inventory.owned[id];
      if (owned) owned.usedInMission = true;
    }
    this.state = next;
    return this.profile;
  }

  private fail(code: EconomyErrorCode, message: string): EconomyResult {
    return { success: false, error: { code, message }, profile: this.profile };
  }
}
