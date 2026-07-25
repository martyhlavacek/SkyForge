import { z } from 'zod';
import { SafeIdSchema } from './safeId';

/** Formation definition schema (Sprint 4.1), PDR §12. */
export const FormationSchema = z.object({
  id: SafeIdSchema,
  movement: z.string(), // shared default movement pattern
  members: z
    .array(
      z.object({
        enemy: z.string(),
        offsetX: z.number(),
        offsetY: z.number(),
        delay: z.number().nonnegative().default(0),
        movementOverride: z.string().optional(),
        fireDelay: z.number().nonnegative().default(0), // adds to pattern firstShotDelay
      }),
    )
    .min(1),
});

export type FormationDef = z.infer<typeof FormationSchema>;
export type FormationMemberDef = FormationDef['members'][number];
