import { z } from 'zod';
import { SafeIdSchema } from './safeId';

export const SimulationArenaTypeSchema = z.enum([
  'level',
  'enemy',
  'weapon',
  'formation',
  'encounter',
  'boss',
  'route',
  'loadout',
]);

export const SimulationArenaConfigSchema = z.object({
  type: SimulationArenaTypeSchema,
  id: SafeIdSchema.optional(),
  levelId: SafeIdSchema.default('level_01'),
  autoFire: z.boolean().default(false),
  repeat: z.boolean().default(true),
  resetDelaySeconds: z.number().min(0).max(30).default(1.5),
});

export const AttentionMarkerKindSchema = z.enum([
  'encounter',
  'peak',
  'recovery',
  'terrain',
  'checkpoint',
  'boss',
  'music',
  'comment',
  'warning',
]);

export const AttentionMarkerSchema = z.object({
  id: SafeIdSchema,
  at: z.number().nonnegative(),
  duration: z.number().nonnegative().default(0),
  kind: AttentionMarkerKindSchema,
  label: z.string().min(1),
  intensity: z.number().min(0).max(1).default(0),
  sourceId: z.string().optional(),
  automatic: z.boolean().default(true),
});

const MovementStateSnapshotSchema = z.object({
  t: z.number().nonnegative(),
  ox: z.number(),
  oy: z.number(),
  x: z.number(),
  y: z.number(),
  phase: z.number().int().nonnegative(),
  phaseT: z.number().nonnegative(),
  aux: z.union([z.number(), z.nan()]),
  fireRateMultiplier: z.number().positive(),
});

const EnemyWeaponSnapshotSchema = z.object({
  patternId: SafeIdSchema,
  cooldown: z.number(),
  elapsed: z.number().nonnegative(),
});

export const EnemyStudioSnapshotSchema = z.object({
  enemyId: SafeIdSchema,
  x: z.number(),
  y: z.number(),
  health: z.number(),
  rewardId: z.string(),
  movementId: SafeIdSchema,
  movementState: MovementStateSnapshotSchema,
  weaponPatterns: z.array(SafeIdSchema),
  weapons: z.array(EnemyWeaponSnapshotSchema),
  mineCooldown: z.number(),
  mineTimer: z.number(),
});

export const ProjectileStudioSnapshotSchema = z.object({
  x: z.number(),
  y: z.number(),
  texture: z.string().min(1),
  vx: z.number(),
  vy: z.number(),
  damage: z.number().nonnegative(),
  category: z.number().int().nonnegative(),
  lifetime: z.number(),
  circleRadius: z.number().positive().optional(),
  rotation: z.number(),
  homing: z
    .object({
      turnRateDegPerSec: z.number().nonnegative(),
      acquireDelay: z.number().nonnegative(),
      age: z.number().nonnegative(),
    })
    .optional(),
});

export const PooledProjectileStudioSnapshotSchema = z.object({
  pool: z.enum(['player', 'enemy', 'missile']),
  state: ProjectileStudioSnapshotSchema,
});

export const GroundTargetStudioSnapshotSchema = z.object({
  targetId: SafeIdSchema,
  health: z.number(),
  destroyed: z.boolean(),
  engaged: z.boolean(),
  flashTimer: z.number().nonnegative(),
  weapon: EnemyWeaponSnapshotSchema.optional(),
});

export const PickupStudioSnapshotSchema = z.object({
  pickupId: SafeIdSchema,
  x: z.number(),
  y: z.number(),
  life: z.number(),
  baseX: z.number(),
  swayT: z.number().nonnegative(),
  fading: z.boolean(),
  alpha: z.number().min(0).max(1),
  rewardId: z.string(),
});

export const StudioRuntimeSnapshotSchema = z.object({
  id: SafeIdSchema,
  levelId: SafeIdSchema,
  levelTime: z.number().nonnegative(),
  capturedAt: z.number().nonnegative(),
  player: z.object({
    x: z.number(),
    y: z.number(),
    armor: z.number().nonnegative(),
    shield: z.number().nonnegative(),
    energy: z.number().nonnegative(),
  }),
  terrainState: z
    .record(z.string(), z.enum(['open', 'closed', 'active', 'destroyed']))
    .default({}),
  score: z.number().nonnegative().default(0),
  multiplier: z.number().positive().default(1),
  activeEnemies: z.number().int().nonnegative().default(0),
  activeProjectiles: z.number().int().nonnegative().default(0),
  enemyStates: z.array(EnemyStudioSnapshotSchema).default([]),
  projectileStates: z.array(PooledProjectileStudioSnapshotSchema).default([]),
  pickupStates: z.array(PickupStudioSnapshotSchema).default([]),
  groundTargetStates: z.array(GroundTargetStudioSnapshotSchema).default([]),
  bossId: SafeIdSchema.optional(),
  tuningFingerprint: z.string().default('built-in'),
});

export const StudioRuntimeSnapshotIndexSchema = z.object({
  id: SafeIdSchema,
  levelTime: z.number().nonnegative(),
  capturedAt: z.number().nonnegative(),
  activeEnemies: z.number().int().nonnegative(),
  activeProjectiles: z.number().int().nonnegative(),
});

export const RuntimeTelemetrySeriesPointSchema = z.object({
  time: z.number().nonnegative(),
  activeEnemies: z.number().int().nonnegative(),
  enemyProjectiles: z.number().int().nonnegative(),
  playerProjectiles: z.number().int().nonnegative(),
  survivability: z.number().min(0).max(1),
  multiplier: z.number().positive(),
  frameMs: z.number().nonnegative(),
  intensity: z.number().min(0).max(1),
});

export const StudioRuntimeStateSchema = z.object({
  levelId: SafeIdSchema.optional(),
  levelTime: z.number().optional(),
  duration: z.number().positive().optional(),
  scene: z.string().optional(),
  paused: z.boolean().optional(),
  timeScale: z.number().positive().optional(),
  snapshotInterval: z.number().min(1).max(30).optional(),
  music: z.unknown().optional(),
  arena: SimulationArenaConfigSchema.optional(),
  snapshots: z.array(StudioRuntimeSnapshotIndexSchema).default([]),
  telemetry: z.array(RuntimeTelemetrySeriesPointSchema).default([]),
  metrics: z
    .object({
      activeEnemies: z.number().int().nonnegative(),
      enemyProjectiles: z.number().int().nonnegative(),
      playerProjectiles: z.number().int().nonnegative(),
      survivability: z.number().min(0).max(1),
      multiplier: z.number().positive(),
      intensity: z.number().min(0).max(1),
    })
    .optional(),
});

export type SimulationArenaType = z.infer<typeof SimulationArenaTypeSchema>;
export type SimulationArenaConfig = z.infer<typeof SimulationArenaConfigSchema>;
export type AttentionMarker = z.infer<typeof AttentionMarkerSchema>;
export type EnemyStudioSnapshotData = z.infer<typeof EnemyStudioSnapshotSchema>;
export type ProjectileStudioSnapshotData = z.infer<typeof ProjectileStudioSnapshotSchema>;
export type PooledProjectileStudioSnapshot = z.infer<
  typeof PooledProjectileStudioSnapshotSchema
>;
export type PickupStudioSnapshotData = z.infer<typeof PickupStudioSnapshotSchema>;
export type GroundTargetStudioSnapshotData = z.infer<
  typeof GroundTargetStudioSnapshotSchema
>;
export type StudioRuntimeSnapshot = z.infer<typeof StudioRuntimeSnapshotSchema>;
export type StudioRuntimeSnapshotIndex = z.infer<typeof StudioRuntimeSnapshotIndexSchema>;
export type RuntimeTelemetrySeriesPoint = z.infer<
  typeof RuntimeTelemetrySeriesPointSchema
>;
export type StudioRuntimeState = z.infer<typeof StudioRuntimeStateSchema>;
