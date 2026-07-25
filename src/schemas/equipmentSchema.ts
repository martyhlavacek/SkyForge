import { z } from 'zod';
import { SafeIdSchema } from './safeId';

export const EquipmentCategorySchema = z.enum([
  'hull',
  'primaryWeapon',
  'secondaryWeapon',
  'propulsion',
  'generator',
  'shield',
  'armor',
  'utility',
]);

export type EquipmentCategory = z.infer<typeof EquipmentCategorySchema>;

export const UnlockRequirementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('missionComplete'), missionId: SafeIdSchema }),
  z.object({ type: z.literal('bossDefeated'), bossId: SafeIdSchema }),
  z.object({ type: z.literal('campaignTier'), tier: z.number().int().nonnegative() }),
  z.object({ type: z.literal('optionalObjective'), objectiveId: SafeIdSchema }),
  z.object({ type: z.literal('discovery'), secretId: SafeIdSchema }),
]);

export type UnlockRequirement = z.infer<typeof UnlockRequirementSchema>;

const upgradeLevel = z.object({
  cost: z.number().int().nonnegative(),
  description: z.string().min(1),
  modifiers: z.record(z.string(), z.number().finite()).default({}),
});

const common = {
  id: SafeIdSchema,
  displayName: z.string().min(1),
  description: z.string().min(1),
  tier: z.number().int().min(0).max(4),
  purchaseCost: z.number().int().nonnegative(),
  resaleRate: z.number().min(0).max(1).default(0.75),
  mass: z.number().nonnegative(),
  passivePowerDraw: z.number().nonnegative().default(0),
  compatibilityTags: z.array(z.string().min(1)).default([]),
  roleTags: z.array(z.string().min(1)).default([]),
  unlockRequirement: UnlockRequirementSchema.optional(),
  iconKey: z.string().min(1).default('equipment_placeholder'),
  unique: z.boolean().default(true),
  upgradeLevels: z.array(upgradeLevel).max(4).default([]),
};

const hardpointClass = z.enum(['light', 'medium', 'heavy']);
const secondaryClass = z.enum(['missile', 'rocket', 'bomb', 'universal']);
const sizeClass = z.enum(['small', 'medium', 'large']);

export const HullEquipmentSchema = z.object({
  ...common,
  category: z.literal('hull'),
  baseArmor: z.number().positive(),
  nominalMass: z.number().positive(),
  maxSupportedMass: z.number().positive(),
  speedFactor: z.number().positive(),
  thrustFactor: z.number().positive(),
  shieldFactor: z.number().positive(),
  utilitySlots: z.number().int().nonnegative().max(3),
  allowedPrimaryClasses: z.array(hardpointClass).min(1),
  allowedSecondaryClasses: z.array(secondaryClass).min(1),
  allowedPropulsionSizes: z.array(sizeClass).min(1),
  allowedGeneratorSizes: z.array(sizeClass).min(1),
  allowedShieldSizes: z.array(sizeClass).min(1),
  allowedArmorSizes: z.array(sizeClass).min(1),
  navigationEnvelope: z.object({
    collisionRadius: z.number().positive(),
    minimumCorridorWidth: z.number().positive(),
  }),
});

export const WeaponEquipmentSchema = z.object({
  ...common,
  category: z.enum(['primaryWeapon', 'secondaryWeapon']),
  weaponDefId: SafeIdSchema,
  hardpointClass: z.union([hardpointClass, secondaryClass]),
  energyPerVolley: z.number().nonnegative(),
  damageMultiplier: z.number().positive().default(1),
  fireIntervalMultiplier: z.number().positive().default(1),
  targetDomain: z.enum(['air', 'ground', 'both']).default('both'),
});

export const PropulsionEquipmentSchema = z.object({
  ...common,
  category: z.literal('propulsion'),
  sizeClass,
  maxSpeed: z.number().positive(),
  focusRatio: z.number().positive().max(1),
  thrust: z.number().positive(),
  drag: z.number().positive(),
});

export const GeneratorEquipmentSchema = z.object({
  ...common,
  category: z.literal('generator'),
  sizeClass,
  energyCapacity: z.number().positive(),
  energyRegenPerSecond: z.number().nonnegative(),
  maxContinuousDraw: z.number().nonnegative(),
  shieldEfficiency: z.number().positive().default(1),
});

export const ShieldEquipmentSchema = z.object({
  ...common,
  category: z.literal('shield'),
  sizeClass,
  capacity: z.number().positive(),
  rechargeDelay: z.number().nonnegative(),
  rechargeRate: z.number().nonnegative(),
  energyPerPoint: z.number().nonnegative(),
});

export const ArmorEquipmentSchema = z.object({
  ...common,
  category: z.literal('armor'),
  sizeClass,
  armorBonus: z.number().positive(),
});

export const UtilityEquipmentSchema = z.object({
  ...common,
  category: z.literal('utility'),
  modifiers: z
    .object({
      pickupMagnetRadius: z.number().nonnegative().optional(),
      effectiveMassMultiplier: z.number().positive().optional(),
      shieldRechargeDelayMultiplier: z.number().positive().optional(),
      shieldRechargeRateMultiplier: z.number().positive().optional(),
      energyRegenMultiplier: z.number().positive().optional(),
    })
    .default({}),
});

export const EquipmentSchema = z.discriminatedUnion('category', [
  HullEquipmentSchema,
  WeaponEquipmentSchema.extend({ category: z.literal('primaryWeapon') }),
  WeaponEquipmentSchema.extend({ category: z.literal('secondaryWeapon') }),
  PropulsionEquipmentSchema,
  GeneratorEquipmentSchema,
  ShieldEquipmentSchema,
  ArmorEquipmentSchema,
  UtilityEquipmentSchema,
]);

export type EquipmentDef = z.infer<typeof EquipmentSchema>;
export type HullEquipmentDef = z.infer<typeof HullEquipmentSchema>;
export type WeaponEquipmentDef = z.infer<typeof WeaponEquipmentSchema>;
export type PropulsionEquipmentDef = z.infer<typeof PropulsionEquipmentSchema>;
export type GeneratorEquipmentDef = z.infer<typeof GeneratorEquipmentSchema>;
export type ShieldEquipmentDef = z.infer<typeof ShieldEquipmentSchema>;
export type ArmorEquipmentDef = z.infer<typeof ArmorEquipmentSchema>;
export type UtilityEquipmentDef = z.infer<typeof UtilityEquipmentSchema>;
export type EquipmentUpgradeLevel = z.infer<typeof upgradeLevel>;
