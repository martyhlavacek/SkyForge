import { z } from 'zod';
import { SafeIdSchema } from './safeId';

/**
 * Movement pattern schemas (Sprints 3.4–3.5), PDR §11.
 * Discriminated union on `type`. All patterns are evaluated position-based
 * by MovementRunner for determinism.
 */

const straight = z.object({
  id: SafeIdSchema,
  type: z.literal('straight'),
  angleDeg: z.number().default(90), // 90 = straight down (screen +Y)
  speed: z.number().nonnegative(), // 0 = stationary (e.g. static_hold mines)
});

const sine = z.object({
  id: SafeIdSchema,
  type: z.literal('sine'),
  verticalSpeed: z.number(),
  horizontalAmplitude: z.number(),
  frequency: z.number().positive(), // Hz
  duration: z.number().positive().optional(),
});

const sweep = z.object({
  id: SafeIdSchema,
  type: z.literal('sweep'),
  fromSide: z.enum(['left', 'right']),
  angleDeg: z.number(), // travel direction; 0 = +X
  speed: z.number().positive(),
});

const patrol = z.object({
  id: SafeIdSchema,
  type: z.literal('patrol'),
  y: z.number(),
  horizontalSpeed: z.number().positive(),
  leftX: z.number(),
  rightX: z.number(),
  entrySpeed: z.number().positive(),
});

const bezier = z.object({
  id: SafeIdSchema,
  type: z.literal('bezier'),
  points: z.array(z.tuple([z.number(), z.number()])).length(4), // relative to spawn
  duration: z.number().positive(),
});

const diveRetreat = z.object({
  id: SafeIdSchema,
  type: z.literal('dive_retreat'),
  diveTargetYOffset: z.number(),
  diveSpeed: z.number().positive(),
  pauseDuration: z.number().nonnegative(),
  retreatSpeed: z.number().positive(),
});

const stopAndFire = z.object({
  id: SafeIdSchema,
  type: z.literal('stop_and_fire'),
  entrySpeed: z.number().positive(),
  stopY: z.number(),
  holdDuration: z.number().positive(),
  exitAngleDeg: z.number(),
  exitSpeed: z.number().positive(),
  holdFireRateMultiplier: z.number().positive().default(0.5), // cooldown × this while parked
});

const enterAttackExit = z.object({
  id: SafeIdSchema,
  type: z.literal('enter_attack_exit'),
  enter: z.object({
    fromSide: z.enum(['left', 'right']),
    targetX: z.number(),
    targetY: z.number(),
    speed: z.number().positive(),
  }),
  holdDuration: z.number().positive(),
  exit: z.object({ angleDeg: z.number(), speed: z.number().positive() }),
});

export const MovementSchema = z.discriminatedUnion('type', [
  straight,
  sine,
  sweep,
  patrol,
  bezier,
  diveRetreat,
  stopAndFire,
  enterAttackExit,
]);

export type MovementDef = z.infer<typeof MovementSchema>;
