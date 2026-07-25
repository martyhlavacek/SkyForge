import { z } from 'zod';
import { SafeIdSchema } from './safeId';

/**
 * Enemy projectile pattern schema (Sprint 3.3), PDR §10.2.
 * Angle convention: degrees. aimed=false → measured from straight DOWN
 * (screen +Y). aimed=true → offsets from the enemy→player aim angle.
 */
export const ProjectilePatternSchema = z
  .object({
    id: SafeIdSchema,
    projectileTexture: z.string(),
    count: z.number().int().min(1),
    angles: z.array(z.number()),
    aimed: z.boolean().default(false),
    speed: z.number().nonnegative(), // 0 for stationary drops (e.g. mine_layer)
    cooldown: z.number().positive(),
    firstShotDelay: z.number().nonnegative().default(0.8),
    damage: z.number().default(1),
    lifetime: z.number().positive().default(6),
    // Rotate the whole (unaimed) pattern over time (S6.3 sweeping fan).
    angleSweep: z
      .object({
        from: z.number(),
        to: z.number(),
        period: z.number().positive(), // s for a full from→to→from cycle
      })
      .optional(),
  })
  .refine((p) => p.angles.length === p.count, {
    message: 'angles length must equal count',
  });

export type ProjectilePatternDef = z.infer<typeof ProjectilePatternSchema>;
