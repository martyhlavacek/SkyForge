import { z } from 'zod';
import { SafeIdSchema } from './safeId';

/**
 * Encounter schema (Sprint 4.3), PDR §13.
 * Implemented events: spawnFormation, spawnEnemy, wait_for_clear,
 * setScrollSpeed, spawnPickup (entity lands S5.2), setFlag.
 * Deferred events parse but warn at runtime: triggerDialogue, playSound,
 * playMusicCue, startMiniboss, startBoss, spawnHazard, activateGroundTarget.
 */
const spawnFormation = z.object({
  at: z.number().nonnegative(),
  type: z.literal('spawnFormation'),
  formation: z.string(),
  x: z.number(),
  y: z.number(),
});

const spawnEnemy = z.object({
  at: z.number().nonnegative(),
  type: z.literal('spawnEnemy'),
  enemy: z.string(),
  x: z.number(),
  y: z.number(),
  movementOverride: z.string().optional(),
});

const waitForClear = z.object({
  at: z.number().nonnegative(),
  type: z.literal('wait_for_clear'),
});

const setScrollSpeed = z.object({
  at: z.number().nonnegative(),
  type: z.literal('setScrollSpeed'),
  multiplier: z.number().positive(),
});

const spawnPickup = z.object({
  at: z.number().nonnegative(),
  type: z.literal('spawnPickup'),
  pickup: z.string(),
  x: z.number(),
  y: z.number(),
  condition: z.string().optional(), // flag name; stubbed always-true until S5.2
});

const setFlag = z.object({
  at: z.number().nonnegative(),
  type: z.literal('setFlag'),
  flag: z.string(),
});

const startBoss = z.object({
  at: z.number().nonnegative(),
  type: z.enum(['startMiniboss', 'startBoss']),
  boss: z.string(),
});

const spawnHazard = z.object({
  at: z.number().nonnegative(),
  type: z.literal('spawnHazard'),
  hazard: z.literal('minefield'),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  count: z.number().int().min(1),
});

const deferred = z.object({
  at: z.number().nonnegative(),
  type: z.enum([
    'triggerDialogue',
    'playSound',
    'playMusicCue',
    'activateGroundTarget',
  ]),
});

export const EncounterEventSchema = z.discriminatedUnion('type', [
  spawnFormation,
  spawnEnemy,
  waitForClear,
  setScrollSpeed,
  spawnPickup,
  setFlag,
  spawnHazard,
  startBoss,
  deferred,
]);

export const EncounterSchema = z.object({
  id: SafeIdSchema,
  estimatedDuration: z.number().positive(),
  difficulty: z.number().int().min(1).max(5),
  skillsTested: z.array(z.string()),
  events: z.array(EncounterEventSchema).min(1),
  completion: z.object({
    type: z.enum(['duration', 'allClear', 'flag']),
    flag: z.string().optional(),
  }),
});

export type EncounterDef = z.infer<typeof EncounterSchema>;
export type EncounterEvent = z.infer<typeof EncounterEventSchema>;
