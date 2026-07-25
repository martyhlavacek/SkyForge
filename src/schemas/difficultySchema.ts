import { z } from 'zod';

/** Difficulty modifier table (Sprint 7.2), PDR §15. */
const modifiers = z.object({
  enemyHealthMultiplier: z.number().positive(),
  projectileSpeedMultiplier: z.number().positive(),
  spawnDelayMultiplier: z.number().positive(),
});

export const DifficultySchema = z.object({
  id: z.literal('difficulty'),
  levels: z.object({
    easy: modifiers,
    normal: modifiers,
    hard: modifiers,
  }),
});

export type DifficultyDef = z.infer<typeof DifficultySchema>;
export type DifficultyModifiers = z.infer<typeof modifiers>;
export type DifficultyName = keyof DifficultyDef['levels'];
