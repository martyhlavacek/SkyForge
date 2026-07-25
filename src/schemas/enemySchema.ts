import { z } from 'zod';
import { SafeIdSchema } from './safeId';

/** Enemy definition schema (Sprint 3.1), PDR §9.1. */
export const EnemySchema = z.object({
  id: SafeIdSchema,
  displayName: z.string(),
  sprite: z.string(),
  health: z.number().positive(),
  collisionDamage: z.number().nonnegative(),
  scoreValue: z.number().nonnegative(),
  creditValue: z.number().int().nonnegative().default(0),
  movementPattern: z.string(),
  // string = one weapon; array = several concurrent weapons (S5.1 bomber);
  // null = unarmed.
  weaponPattern: z.union([z.string(), z.array(z.string()).min(1)]).nullable(),
  speed: z.number(),
  hitbox: z.object({
    type: z.literal('circle'),
    radius: z.number().positive(),
  }),
  drops: z
    .array(z.object({ pickup: z.string(), chance: z.number().min(0).max(1) }))
    .default([]),
});

export type EnemyDef = z.infer<typeof EnemySchema>;
