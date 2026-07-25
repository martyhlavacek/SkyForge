import { z } from 'zod';
import { SafeIdSchema } from './safeId';

export const ShipLoadoutSchema = z.object({
  id: SafeIdSchema,
  name: z.string().min(1),
  hullId: SafeIdSchema,
  primaryWeaponId: SafeIdSchema,
  secondaryWeaponId: SafeIdSchema.optional(),
  propulsionId: SafeIdSchema,
  generatorId: SafeIdSchema,
  shieldId: SafeIdSchema.optional(),
  armorId: SafeIdSchema.optional(),
  utilityIds: z.array(SafeIdSchema).default([]),
});

export type ShipLoadout = z.infer<typeof ShipLoadoutSchema>;

export const OwnedEquipmentStateSchema = z.object({
  equipmentId: SafeIdSchema,
  upgradeLevel: z.number().int().nonnegative(),
  acquiredAtCampaignStep: z.number().int().nonnegative(),
  usedInMission: z.boolean(),
});

export type OwnedEquipmentState = z.infer<typeof OwnedEquipmentStateSchema>;

export const CreditTransactionSchema = z.object({
  id: SafeIdSchema,
  runId: SafeIdSchema.optional(),
  missionId: SafeIdSchema.optional(),
  timestamp: z.number().finite(),
  amount: z.number().int(),
  reason: z.enum([
    'missionSettlement',
    'missionReward',
    'difficultyBonus',
    'purchase',
    'sale',
    'refund',
    'upgrade',
    'migrationGrant',
    'debugGrant',
  ]),
  sourceId: z.string().min(1).optional(),
  balanceAfter: z.number().int().nonnegative(),
});

export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;

export const MissionRecordSchema = z.object({
  completions: z.number().int().nonnegative(),
  bestScore: z.number().nonnegative(),
  bestTimeSeconds: z.number().nonnegative(),
  bestCredits: z.number().int().nonnegative(),
});

export type MissionRecord = z.infer<typeof MissionRecordSchema>;

export const CampaignProfileSchema = z.object({
  profileId: SafeIdSchema,
  bankedCredits: z.number().int().nonnegative(),
  campaignTier: z.number().int().min(0).max(4),
  completedMissions: z.array(SafeIdSchema),
  unlockedEquipment: z.array(SafeIdSchema),
  inventory: z.object({
    owned: z.record(z.string(), OwnedEquipmentStateSchema),
  }),
  loadouts: z.array(ShipLoadoutSchema).min(1),
  activeLoadoutId: SafeIdSchema,
  missionRecords: z.record(z.string(), MissionRecordSchema),
  processedSettlementIds: z.array(z.string().min(1)).default([]),
  recentLedger: z.array(CreditTransactionSchema).max(100).default([]),
});

export type CampaignProfile = z.infer<typeof CampaignProfileSchema>;
