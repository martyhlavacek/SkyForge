import { z } from 'zod';
import { SafeIdSchema } from './safeId';

/** Weapon definition schema (Sprint 3.2), PDR §8.4. */
export const WeaponSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string(),
  projectileTexture: z.string(),
  collisionCategory: z.enum(['player', 'enemy']),
  levels: z
    .array(
      z
        .object({
          damage: z.number(),
          fireInterval: z.number().positive(),
          projectileSpeed: z.number(),
          projectileCount: z.number().int().min(1),
          spreadAngles: z.array(z.number()), // degrees relative to straight up
          muzzles: z.array(z.tuple([z.number(), z.number()])).min(1),
          // Homing (S5.4 missiles). Omit for straight-firing weapons.
          homing: z
            .object({
              turnRateDegPerSec: z.number().positive(),
              acquireDelay: z.number().nonnegative().default(0),
            })
            .optional(),
        })
        .refine((lvl) => lvl.spreadAngles.length === lvl.projectileCount, {
          message: 'spreadAngles length must equal projectileCount',
        }),
    )
    .min(1),
});

export type WeaponDef = z.infer<typeof WeaponSchema>;
export type WeaponLevelDef = WeaponDef['levels'][number];
