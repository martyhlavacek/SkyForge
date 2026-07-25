import { z } from 'zod';
import { SafeIdSchema } from './safeId';

const LEVEL_WIDTH = 540;

export const LevelMusicAssignmentSchema = z.object({
  trackId: SafeIdSchema.nullable().default(null),
  loop: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.8),
  startOffsetSeconds: z.number().min(0).max(86_400).default(0),
  fadeSeconds: z.number().min(0).max(10).default(1),
});

const encounterEvent = z.object({
  at: z.number().nonnegative(),
  encounter: z.string().min(1),
});

const recoveryEvent = z.object({
  at: z.number().nonnegative(),
  type: z.literal('recovery'),
  duration: z.number().positive(),
});

const checkpointEvent = z.object({
  at: z.number().nonnegative(),
  type: z.literal('checkpoint'),
  name: z.string().min(1),
});

const terrainStateEvent = z.object({
  at: z.number().nonnegative(),
  type: z.literal('terrainState'),
  target: z.string().min(1),
  state: z.enum(['open', 'closed', 'destroyed']),
});

export const LevelEventSchema = z.union([
  encounterEvent,
  recoveryEvent,
  checkpointEvent,
  terrainStateEvent,
]);

export const LevelSchema = z
  .object({
    formatVersion: z.literal('1.0'),
    id: SafeIdSchema,
    displayName: z.string().min(1),
    music: z.string().min(1),
    levelMusic: LevelMusicAssignmentSchema.optional(),
    levelPackage: z.string().min(1).optional(),
    durationTarget: z.number().positive(),
    baseScrollSpeed: z.number().positive().default(100),
    scrollProfile: z
      .array(
        z.object({
          startTime: z.number().nonnegative(),
          endTime: z.number().positive(),
          speed: z.number().positive(),
        }),
      )
      .optional(),
    events: z.array(LevelEventSchema),
    groundObjects: z
      .array(
        z.object({
          type: z.literal('turret'),
          id: SafeIdSchema,
          worldY: z.number().positive(),
          x: z.number().min(0).max(LEVEL_WIDTH),
          creditValue: z.number().int().nonnegative().default(0),
        }),
      )
      .default([]),
  })
  .superRefine((level, ctx) => {
    let previousEventAt = -Infinity;
    const checkpointNames = new Set<string>();
    level.events.forEach((event, index) => {
      if (event.at < previousEventAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', index, 'at'],
          message: 'events must be in chronological order',
        });
      }
      if (event.at > level.durationTarget) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', index, 'at'],
          message: 'event occurs after durationTarget',
        });
      }
      previousEventAt = event.at;
      if ('type' in event && event.type === 'checkpoint') {
        if (checkpointNames.has(event.name)) {
          ctx.addIssue({
            code: 'custom',
            path: ['events', index, 'name'],
            message: `duplicate checkpoint name "${event.name}"`,
          });
        }
        checkpointNames.add(event.name);
      }
    });

    let previousEnd = -Infinity;
    level.scrollProfile?.forEach((segment, index) => {
      if (segment.endTime <= segment.startTime) {
        ctx.addIssue({
          code: 'custom',
          path: ['scrollProfile', index, 'endTime'],
          message: 'must be greater than startTime',
        });
      }
      if (segment.startTime < previousEnd) {
        ctx.addIssue({
          code: 'custom',
          path: ['scrollProfile', index, 'startTime'],
          message: 'scroll segments must be ordered and may not overlap',
        });
      }
      if (segment.endTime > level.durationTarget) {
        ctx.addIssue({
          code: 'custom',
          path: ['scrollProfile', index, 'endTime'],
          message: 'scroll segment extends beyond durationTarget',
        });
      }
      previousEnd = segment.endTime;
    });
  });

export type LevelDef = z.infer<typeof LevelSchema>;
export type LevelEvent = z.infer<typeof LevelEventSchema>;
export type GroundObjectDef = LevelDef['groundObjects'][number];
