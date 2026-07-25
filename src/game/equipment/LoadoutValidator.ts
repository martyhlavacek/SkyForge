import type { CampaignProfile, ShipLoadout } from '../../schemas/profileSchema';
import type {
  EquipmentDef,
  GeneratorEquipmentDef,
  HullEquipmentDef,
} from '../../schemas/equipmentSchema';
import { equipmentRegistry, type EquipmentRegistry } from './EquipmentRegistry';

export type LoadoutErrorCode =
  | 'UNKNOWN_ITEM'
  | 'WRONG_CATEGORY'
  | 'NOT_OWNED'
  | 'NOT_UNLOCKED'
  | 'INCOMPATIBLE_SLOT'
  | 'MASS_EXCEEDED'
  | 'POWER_EXCEEDED'
  | 'MISSING_REQUIRED_SLOT'
  | 'UTILITY_SLOT_EXCEEDED'
  | 'DUPLICATE_UNIQUE_ITEM';

export interface LoadoutError {
  code: LoadoutErrorCode;
  slot?: string;
  equipmentId?: string;
  message: string;
}

export interface LoadoutValidationResult {
  valid: boolean;
  errors: LoadoutError[];
  totalMass: number;
  passivePowerDraw: number;
  maxSupportedMass: number;
  maxContinuousDraw: number;
}

function itemFor(
  registry: EquipmentRegistry,
  id: string | undefined,
  expected: EquipmentDef['category'],
  slot: string,
  errors: LoadoutError[],
): EquipmentDef | undefined {
  if (!id) {
    errors.push({ code: 'MISSING_REQUIRED_SLOT', slot, message: `${slot} is required` });
    return undefined;
  }
  const item = registry.get(id);
  if (!item) {
    errors.push({ code: 'UNKNOWN_ITEM', slot, equipmentId: id, message: `Unknown item: ${id}` });
    return undefined;
  }
  if (item.category !== expected) {
    errors.push({
      code: 'WRONG_CATEGORY',
      slot,
      equipmentId: id,
      message: `${item.displayName} cannot be equipped as ${slot}`,
    });
    return undefined;
  }
  return item;
}

function requireProfileAccess(item: EquipmentDef, profile: CampaignProfile | undefined, errors: LoadoutError[]): void {
  if (!profile) return;
  if (!profile.inventory.owned[item.id]) {
    errors.push({
      code: 'NOT_OWNED',
      equipmentId: item.id,
      message: `${item.displayName} is not owned`,
    });
  }
  if (!profile.unlockedEquipment.includes(item.id)) {
    errors.push({
      code: 'NOT_UNLOCKED',
      equipmentId: item.id,
      message: `${item.displayName} is not unlocked`,
    });
  }
}

export class LoadoutValidator {
  constructor(private readonly registry: EquipmentRegistry = equipmentRegistry) {}

  validate(loadout: ShipLoadout, profile?: CampaignProfile): LoadoutValidationResult {
    const errors: LoadoutError[] = [];
    const hull = itemFor(this.registry, loadout.hullId, 'hull', 'hull', errors) as HullEquipmentDef | undefined;
    const primary = itemFor(this.registry, loadout.primaryWeaponId, 'primaryWeapon', 'primary weapon', errors);
    const secondary = loadout.secondaryWeaponId
      ? itemFor(this.registry, loadout.secondaryWeaponId, 'secondaryWeapon', 'secondary weapon', errors)
      : undefined;
    const propulsion = itemFor(this.registry, loadout.propulsionId, 'propulsion', 'propulsion', errors);
    const generator = itemFor(this.registry, loadout.generatorId, 'generator', 'generator', errors) as GeneratorEquipmentDef | undefined;
    const shield = loadout.shieldId
      ? itemFor(this.registry, loadout.shieldId, 'shield', 'shield', errors)
      : undefined;
    const armor = loadout.armorId
      ? itemFor(this.registry, loadout.armorId, 'armor', 'armor', errors)
      : undefined;
    const utilities = loadout.utilityIds
      .map((id, index) => itemFor(this.registry, id, 'utility', `utility ${index + 1}`, errors))
      .filter((x): x is EquipmentDef => x !== undefined);

    const items = [hull, primary, secondary, propulsion, generator, shield, armor, ...utilities].filter(
      (x): x is EquipmentDef => x !== undefined,
    );
    items.forEach((item) => requireProfileAccess(item, profile, errors));

    if (hull) {
      if (primary?.category === 'primaryWeapon' && !hull.allowedPrimaryClasses.includes(primary.hardpointClass as never)) {
        errors.push({ code: 'INCOMPATIBLE_SLOT', slot: 'primary weapon', equipmentId: primary.id, message: `${primary.displayName} requires an unsupported hardpoint` });
      }
      if (secondary?.category === 'secondaryWeapon' && !hull.allowedSecondaryClasses.includes(secondary.hardpointClass as never)) {
        errors.push({ code: 'INCOMPATIBLE_SLOT', slot: 'secondary weapon', equipmentId: secondary.id, message: `${secondary.displayName} requires an unsupported hardpoint` });
      }
      if (propulsion?.category === 'propulsion' && !hull.allowedPropulsionSizes.includes(propulsion.sizeClass)) {
        errors.push({ code: 'INCOMPATIBLE_SLOT', slot: 'propulsion', equipmentId: propulsion.id, message: `${propulsion.displayName} is not compatible with this hull` });
      }
      if (generator?.category === 'generator' && !hull.allowedGeneratorSizes.includes(generator.sizeClass)) {
        errors.push({ code: 'INCOMPATIBLE_SLOT', slot: 'generator', equipmentId: generator.id, message: `${generator.displayName} is not compatible with this hull` });
      }
      if (shield?.category === 'shield' && !hull.allowedShieldSizes.includes(shield.sizeClass)) {
        errors.push({ code: 'INCOMPATIBLE_SLOT', slot: 'shield', equipmentId: shield.id, message: `${shield.displayName} is not compatible with this hull` });
      }
      if (armor?.category === 'armor' && !hull.allowedArmorSizes.includes(armor.sizeClass)) {
        errors.push({ code: 'INCOMPATIBLE_SLOT', slot: 'armor', equipmentId: armor.id, message: `${armor.displayName} is not compatible with this hull` });
      }
      if (utilities.length > hull.utilitySlots) {
        errors.push({ code: 'UTILITY_SLOT_EXCEEDED', slot: 'utilities', message: `This hull supports ${hull.utilitySlots} utility slot(s)` });
      }
    }

    const ids = items.map((item) => item.id);
    for (const id of new Set(ids)) {
      const item = this.registry.get(id);
      if (item?.unique && ids.filter((candidate) => candidate === id).length > 1) {
        errors.push({ code: 'DUPLICATE_UNIQUE_ITEM', equipmentId: id, message: `${item.displayName} cannot be equipped twice` });
      }
    }

    const totalMass = items.reduce((sum, item) => sum + item.mass, 0);
    const passivePowerDraw = items.reduce((sum, item) => sum + item.passivePowerDraw, 0);
    const maxSupportedMass = hull?.maxSupportedMass ?? 0;
    const maxContinuousDraw = generator?.maxContinuousDraw ?? 0;
    if (hull && totalMass > maxSupportedMass + 1e-9) {
      errors.push({ code: 'MASS_EXCEEDED', message: `Mass ${totalMass.toFixed(1)} exceeds hull limit ${maxSupportedMass.toFixed(1)}` });
    }
    if (generator && passivePowerDraw > maxContinuousDraw + 1e-9) {
      errors.push({ code: 'POWER_EXCEEDED', message: `Passive draw ${passivePowerDraw.toFixed(1)} exceeds generator output ${maxContinuousDraw.toFixed(1)}` });
    }

    return {
      valid: errors.length === 0,
      errors,
      totalMass,
      passivePowerDraw,
      maxSupportedMass,
      maxContinuousDraw,
    };
  }
}

export const loadoutValidator = new LoadoutValidator();
