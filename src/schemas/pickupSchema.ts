import { z } from 'zod';
import { SafeIdSchema } from './safeId';

export const PickupSchema = z.object({
  id: SafeIdSchema,
  texture: z.string().min(1),
  effect: z.enum(['weapon_upgrade', 'shield', 'weapon_swap', 'credits', 'armorRepair']),
  magnitude: z.number().positive().default(1),
  weapon: z.string().optional(),
  magnetizable: z.boolean().default(false),
  fallSpeed: z.number().positive().default(60),
  lifetime: z.number().positive().default(10),
});

export type PickupDef = z.infer<typeof PickupSchema>;
