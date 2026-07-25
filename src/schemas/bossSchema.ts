import { z } from 'zod';
import { SafeIdSchema } from './safeId';

/**
 * Boss definition schema (Sprint 6.1), PDR §16.
 * A boss is choreography over the existing movement + projectile-pattern
 * systems: phases gated by health %, each with its own movement, weapon
 * patterns, and optional destructible parts.
 */
const bossPart = z.object({
  id: SafeIdSchema,
  offsetX: z.number(),
  offsetY: z.number(),
  health: z.number().positive(),
  radius: z.number().positive(),
  weaponPattern: z.string().optional(),
  scoreValue: z.number().nonnegative(),
  creditValue: z.number().int().nonnegative().default(0),
});

const bossPhase = z.object({
  name: z.string(),
  // Phase is active while current hp% > threshold (and no earlier phase's
  // threshold is met). 0 = final phase.
  healthThreshold: z.number().min(0).max(1),
  movement: z.string(),
  weaponPatterns: z.array(z.string()),
  parts: z.array(bossPart).default([]),
  telegraphDuration: z.number().nonnegative().default(1.0),
});

export const BossSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string(),
  sprite: z.string(),
  totalHealth: z.number().positive(),
  creditValue: z.number().int().nonnegative(),
  hitboxRadius: z.number().positive(),
  phases: z.array(bossPhase).min(1),
  enrage: z
    .object({
      afterSeconds: z.number().positive(),
      cooldownMultiplier: z.number().positive(),
    })
    .optional(),
  defeatDuration: z.number().positive().default(2.5),
});

export type BossDef = z.infer<typeof BossSchema>;
export type BossPhaseDef = z.infer<typeof bossPhase>;
export type BossPartDef = z.infer<typeof bossPart>;
