import type { CampaignProfile, ShipLoadout } from '../../schemas/profileSchema';
import type {
  ArmorEquipmentDef,
  EquipmentDef,
  EquipmentUpgradeLevel,
  GeneratorEquipmentDef,
  HullEquipmentDef,
  PropulsionEquipmentDef,
  ShieldEquipmentDef,
  UtilityEquipmentDef,
  WeaponEquipmentDef,
} from '../../schemas/equipmentSchema';
import { equipmentRegistry, type EquipmentRegistry } from './EquipmentRegistry';

export interface RuntimeWeaponSpec {
  equipmentId: string;
  weaponDefId: string;
  upgradeLevel: number;
  energyPerVolley: number;
  damageMultiplier: number;
  fireIntervalMultiplier: number;
}

export interface DerivedShipStats {
  maxArmor: number;
  maxShield: number;
  shieldRechargeDelay: number;
  shieldRechargeRate: number;
  shieldRechargeEnergyPerPoint: number;
  maxEnergy: number;
  energyRegenPerSecond: number;
  passivePowerDraw: number;
  maxSpeed: number;
  focusedSpeed: number;
  acceleration: number;
  drag: number;
  totalMass: number;
  maxSupportedMass: number;
  primaryWeapon: RuntimeWeaponSpec;
  secondaryWeapon?: RuntimeWeaponSpec;
  pickupMagnetRadius: number;
  collisionRadius: number;
  minimumCorridorWidth: number;
  statHash: string;
}

function upgradesFor(item: EquipmentDef, profile: CampaignProfile): EquipmentUpgradeLevel[] {
  const level = profile.inventory.owned[item.id]?.upgradeLevel ?? 0;
  return item.upgradeLevels.slice(0, level);
}

function modifier(item: EquipmentDef, profile: CampaignProfile, key: string, mode: 'add' | 'multiply', fallback: number): number {
  const values = upgradesFor(item, profile).map((level) => level.modifiers[key]).filter((value): value is number => value !== undefined);
  if (mode === 'add') return values.reduce((sum, value) => sum + value, fallback);
  return values.reduce((product, value) => product * value, fallback);
}

function required<T extends EquipmentDef['category']>(registry: EquipmentRegistry, id: string, category: T): Extract<EquipmentDef, { category: T }> {
  const item = registry.get(id);
  if (!item || item.category !== category) throw new Error(`Invalid ${category} equipment: ${id}`);
  return item as Extract<EquipmentDef, { category: T }>;
}

function weaponSpec(item: WeaponEquipmentDef, profile: CampaignProfile): RuntimeWeaponSpec {
  const ownedLevel = profile.inventory.owned[item.id]?.upgradeLevel ?? 0;
  return {
    equipmentId: item.id,
    weaponDefId: item.weaponDefId,
    upgradeLevel: ownedLevel,
    energyPerVolley: item.energyPerVolley * modifier(item, profile, 'weaponEnergyMultiplier', 'multiply', 1),
    damageMultiplier: item.damageMultiplier * modifier(item, profile, 'weaponDamageMultiplier', 'multiply', 1),
    fireIntervalMultiplier: item.fireIntervalMultiplier * modifier(item, profile, 'weaponFireIntervalMultiplier', 'multiply', 1),
  };
}

function stableHash(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class ShipStatCalculator {
  constructor(private readonly registry: EquipmentRegistry = equipmentRegistry) {}

  calculate(loadout: ShipLoadout, profile: CampaignProfile): DerivedShipStats {
    const hull = required(this.registry, loadout.hullId, 'hull') as HullEquipmentDef;
    const primary = required(this.registry, loadout.primaryWeaponId, 'primaryWeapon') as WeaponEquipmentDef;
    const secondary = loadout.secondaryWeaponId
      ? (required(this.registry, loadout.secondaryWeaponId, 'secondaryWeapon') as WeaponEquipmentDef)
      : undefined;
    const propulsion = required(this.registry, loadout.propulsionId, 'propulsion') as PropulsionEquipmentDef;
    const generator = required(this.registry, loadout.generatorId, 'generator') as GeneratorEquipmentDef;
    const shield = loadout.shieldId
      ? (required(this.registry, loadout.shieldId, 'shield') as ShieldEquipmentDef)
      : undefined;
    const armor = loadout.armorId
      ? (required(this.registry, loadout.armorId, 'armor') as ArmorEquipmentDef)
      : undefined;
    const utilities = loadout.utilityIds.map((id) => required(this.registry, id, 'utility') as UtilityEquipmentDef);
    const items: EquipmentDef[] = [hull, primary, ...(secondary ? [secondary] : []), propulsion, generator, ...(shield ? [shield] : []), ...(armor ? [armor] : []), ...utilities];

    const utilityMassMultiplier = utilities.reduce(
      (value, item) => value * (item.modifiers.effectiveMassMultiplier ?? 1) * modifier(item, profile, 'effectiveMassMultiplier', 'multiply', 1),
      1,
    );
    const totalMass = items.reduce((sum, item) => sum + item.mass, 0) * utilityMassMultiplier;
    const loadRatio = totalMass / hull.nominalMass;
    const massSpeedCurve = Math.max(0.72, Math.min(1.1, 1 - Math.max(0, loadRatio - 1) * 0.28 + Math.max(0, 1 - loadRatio) * 0.08));

    const armorBonus = armor ? armor.armorBonus + modifier(armor, profile, 'armorBonus', 'add', 0) : 0;
    const hullArmorUpgrade = modifier(hull, profile, 'armorBonus', 'add', 0);
    const shieldCapacity = shield ? shield.capacity + modifier(shield, profile, 'shieldCapacity', 'add', 0) : 0;
    const shieldDelayMultiplier = utilities.reduce(
      (value, item) => value * (item.modifiers.shieldRechargeDelayMultiplier ?? 1) * modifier(item, profile, 'shieldRechargeDelayMultiplier', 'multiply', 1),
      1,
    );
    const shieldRateMultiplier = utilities.reduce(
      (value, item) => value * (item.modifiers.shieldRechargeRateMultiplier ?? 1) * modifier(item, profile, 'shieldRechargeRateMultiplier', 'multiply', 1),
      1,
    );
    const energyRegenMultiplier = utilities.reduce(
      (value, item) => value * (item.modifiers.energyRegenMultiplier ?? 1) * modifier(item, profile, 'energyRegenMultiplier', 'multiply', 1),
      1,
    );

    const draft = {
      maxArmor: hull.baseArmor + armorBonus + hullArmorUpgrade,
      maxShield: shieldCapacity * hull.shieldFactor,
      shieldRechargeDelay: shield ? shield.rechargeDelay * shieldDelayMultiplier : 0,
      shieldRechargeRate: shield ? (shield.rechargeRate + modifier(shield, profile, 'shieldRechargeRate', 'add', 0)) * shieldRateMultiplier : 0,
      shieldRechargeEnergyPerPoint: shield ? shield.energyPerPoint / generator.shieldEfficiency : 0,
      maxEnergy: generator.energyCapacity + modifier(generator, profile, 'energyCapacity', 'add', 0),
      energyRegenPerSecond: (generator.energyRegenPerSecond + modifier(generator, profile, 'energyRegen', 'add', 0)) * energyRegenMultiplier,
      passivePowerDraw: items.reduce((sum, item) => sum + item.passivePowerDraw, 0),
      maxSpeed: (propulsion.maxSpeed + modifier(propulsion, profile, 'maxSpeed', 'add', 0)) * hull.speedFactor * massSpeedCurve,
      focusedSpeed: 0,
      acceleration: ((propulsion.thrust + modifier(propulsion, profile, 'thrust', 'add', 0)) * hull.thrustFactor * hull.nominalMass) / totalMass,
      drag: propulsion.drag + modifier(propulsion, profile, 'drag', 'add', 0),
      totalMass,
      maxSupportedMass: hull.maxSupportedMass,
      primaryWeapon: weaponSpec(primary, profile),
      secondaryWeapon: secondary ? weaponSpec(secondary, profile) : undefined,
      pickupMagnetRadius: 28 + utilities.reduce((sum, item) => sum + (item.modifiers.pickupMagnetRadius ?? 0) + modifier(item, profile, 'pickupMagnetRadius', 'add', 0), 0),
      collisionRadius: hull.navigationEnvelope.collisionRadius,
      minimumCorridorWidth: hull.navigationEnvelope.minimumCorridorWidth,
    };
    draft.focusedSpeed = draft.maxSpeed * propulsion.focusRatio;
    return { ...draft, statHash: stableHash(draft) };
  }
}

export const shipStatCalculator = new ShipStatCalculator();
