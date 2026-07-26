import { z } from 'zod';
import { SafeIdSchema } from './safeId';
import { LevelSchema } from './levelSchema';
import {
  BiomeSchema,
  LevelPackageSchema,
  RouteSetSchema,
  TerrainCollisionSchema,
  TerrainMapSchema,
  TerrainObjectSetSchema,
} from './terrainSchema';
import { DifficultySchema } from './difficultySchema';
import { EnemySchema } from './enemySchema';
import { WeaponSchema } from './weaponSchema';
import { ProjectilePatternSchema } from './projectilePatternSchema';
import { MovementSchema } from './movementSchema';
import { FormationSchema } from './formationSchema';
import { EncounterSchema } from './encounterSchema';
import { BossSchema } from './bossSchema';
import { PickupSchema } from './pickupSchema';
import { EquipmentSchema } from './equipmentSchema';
import { MusicCueSchema } from './musicSchema';

export const STUDIO_PACKAGE_SCHEMA_VERSION = 2 as const;
export const StudioPackageTypeSchema = z.enum(['level', 'tuning', 'music', 'asset']);
export type StudioPackageType = z.infer<typeof StudioPackageTypeSchema>;

const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'must be a semantic version');

export const StudioPackageDependencySchema = z.object({
  type: StudioPackageTypeSchema,
  id: SafeIdSchema,
  versionRange: z.string().min(1).default('*'),
  optional: z.boolean().default(false),
});

export const StudioPackageManifestSchema = z.object({
  id: SafeIdSchema,
  name: z.string().min(1),
  version: SemverSchema,
  description: z.string().default(''),
  authors: z.array(z.string().min(1)).min(1),
  license: z.string().min(1).default('All rights reserved'),
  engineRange: z.string().min(1).default('>=0.3.0'),
  dependencies: z.array(StudioPackageDependencySchema).default([]),
  tags: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  contentRevision: z.number().int().positive().default(1),
});

export const StudioReviewCommentSchema = z.object({
  id: SafeIdSchema,
  author: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  targetPath: z.string().min(1).default('/'),
  body: z.string().min(1),
  status: z.enum(['open', 'resolved']).default('open'),
  severity: z.enum(['note', 'suggestion', 'blocking']).default('note'),
});

export const StudioResourceSchema = z.object({
  id: SafeIdSchema,
  uri: z
    .string()
    .min(1)
    .refine(
      (uri) => !/^[a-z][a-z0-9+.-]*:/i.test(uri) || /^https?:/i.test(uri),
      'must be a relative path or an http(s) URL',
    ),
  mediaType: z.string().min(1),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  bytes: z.number().int().nonnegative().optional(),
  filename: z.string().min(1).optional(),
  embeddedData: z
    .string()
    .regex(/^[A-Za-z0-9+/]*={0,2}$/)
    .optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  license: z.string().optional(),
  attribution: z.string().optional(),
  provenance: z
    .object({
      source: z.string().default('unknown'),
      author: z.string().default(''),
      createdWith: z.string().default(''),
      importedAt: z.string().datetime().optional(),
      notes: z.string().default(''),
    })
    .optional(),
});

const packageBase = {
  schemaVersion: z.literal(STUDIO_PACKAGE_SCHEMA_VERSION),
  manifest: StudioPackageManifestSchema,
  resources: z.array(StudioResourceSchema).default([]),
  reviewComments: z.array(StudioReviewCommentSchema).default([]),
};

export const LevelStudioPackageSchema = z.object({
  format: z.literal('skyforge-level-pack'),
  ...packageBase,
  payload: z.object({
    campaign: z
      .object({
        id: SafeIdSchema,
        displayName: z.string().min(1),
        levelOrder: z.array(SafeIdSchema).min(1),
      })
      .optional(),
    levels: z.array(LevelSchema).min(1),
    levelPackages: z.array(LevelPackageSchema).default([]),
    maps: z.array(TerrainMapSchema).default([]),
    collisions: z.array(TerrainCollisionSchema).default([]),
    routes: z.array(RouteSetSchema).default([]),
    objects: z.array(TerrainObjectSetSchema).default([]),
    biomes: z.array(BiomeSchema).default([]),
  }),
});

export const TuningStudioPackageSchema = z.object({
  format: z.literal('skyforge-tuning-pack'),
  ...packageBase,
  payload: z.object({
    profileId: SafeIdSchema,
    difficulty: DifficultySchema,
    enemies: z.array(EnemySchema),
    weapons: z.array(WeaponSchema),
    projectilePatterns: z.array(ProjectilePatternSchema),
    movementPatterns: z.array(MovementSchema),
    formations: z.array(FormationSchema),
    encounters: z.array(EncounterSchema),
    bosses: z.array(BossSchema),
    pickups: z.array(PickupSchema),
    equipment: z.array(EquipmentSchema),
  }),
});

export const FmWaveformSchema = z.enum([
  'sine',
  'square',
  'sawtooth',
  'triangle',
  'noise',
]);

const fmInstrument = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1),
  kind: z.literal('fm'),
  waveform: FmWaveformSchema.default('sine'),
  carrierRatio: z.number().positive(),
  modulatorRatio: z.number().positive(),
  modulationIndex: z.number().nonnegative(),
  feedback: z.number().min(0).max(1).default(0),
  detuneCents: z.number().min(-1200).max(1200).default(0),
  vibratoRate: z.number().min(0).max(20).default(0),
  vibratoDepth: z.number().min(0).max(2).default(0),
  attack: z.number().nonnegative(),
  decay: z.number().nonnegative(),
  sustain: z.number().min(0).max(1),
  release: z.number().nonnegative(),
  gain: z.number().min(0).max(2).default(0.8),
  pan: z.number().min(-1).max(1).default(0),
});

const sampleInstrument = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1),
  kind: z.literal('sample'),
  resourceId: SafeIdSchema,
  rootNote: z.number().int().min(0).max(127).default(60),
  loop: z.boolean().default(false),
  gain: z.number().min(0).max(2).default(0.8),
  pan: z.number().min(-1).max(1).default(0),
  attack: z.number().nonnegative().default(0),
  release: z.number().nonnegative().default(0.03),
});

export const MusicInstrumentSchema = z.discriminatedUnion('kind', [
  fmInstrument,
  sampleInstrument,
]);

export const TrackerEffectSchema = z.enum([
  'none',
  'slideUp',
  'slideDown',
  'vibrato',
  'retrigger',
  'cut',
]);

export const MusicChannelSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1),
  stemId: SafeIdSchema,
  defaultInstrumentId: SafeIdSchema.optional(),
  gain: z.number().min(0).max(2).default(1),
  pan: z.number().min(-1).max(1).default(0),
  muted: z.boolean().default(false),
  solo: z.boolean().default(false),
});

export const MusicPatternEventSchema = z.object({
  row: z.number().int().nonnegative(),
  channel: z.number().int().nonnegative(),
  note: z.number().int().min(0).max(127).nullable(),
  instrumentId: SafeIdSchema.nullable(),
  velocity: z.number().min(0).max(1).default(0.8),
  durationRows: z.number().int().positive().default(1),
  effect: TrackerEffectSchema.default('none'),
  effectValue: z.number().default(0),
});

export const MusicPatternSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1).default('Pattern'),
  lengthRows: z.number().int().min(4).max(256).default(16),
  rows: z.array(MusicPatternEventSchema),
});

export const MusicCompositionSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1),
  cueId: SafeIdSchema,
  bpm: z.number().min(30).max(300),
  beatsPerBar: z.number().int().positive().default(4),
  rowsPerBeat: z.number().int().min(1).max(16).default(4),
  swing: z.number().min(0).max(0.5).default(0),
  masterGain: z.number().min(0).max(2).default(0.85),
  channels: z
    .array(MusicChannelSchema)
    .min(1)
    .default([
      {
        id: 'channel-1',
        displayName: 'Channel 1',
        stemId: 'melody',
        gain: 1,
        pan: 0,
        muted: false,
        solo: false,
      },
    ]),
  order: z.array(SafeIdSchema).default([]),
  loopStartOrder: z.number().int().nonnegative().default(0),
  loopEndOrder: z.number().int().nonnegative().default(0),
  patterns: z.array(MusicPatternSchema),
});

export const ImportedMusicTrackSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1),
  fileName: z.string().min(1),
  relativePath: z
    .string()
    .regex(/^assets\/audio\/music\/[a-z0-9][a-z0-9._-]*\.mp3$/),
  resourceId: SafeIdSchema,
  mimeType: z.literal('audio/mpeg'),
  byteLength: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  durationSeconds: z.number().positive().optional(),
  source: z.enum(['suno', 'external']),
  importedAt: z.string().datetime(),
});

export const MusicStudioPackageSchema = z.object({
  format: z.literal('skyforge-music-pack'),
  ...packageBase,
  payload: z.object({
    cues: z.array(MusicCueSchema),
    instruments: z.array(MusicInstrumentSchema),
    compositions: z.array(MusicCompositionSchema),
    tracks: z.array(ImportedMusicTrackSchema).default([]),
  }),
});

export const StudioAssetKindSchema = z.enum([
  'playerShip',
  'enemyAircraft',
  'groundVehicle',
  'turret',
  'building',
  'projectile',
  'effect',
  'pickup',
  'ui',
  'terrainTile',
  'overlay',
  'shadow',
]);

export const StudioAssetCollisionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('circle'),
    radius: z.number().positive(),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
  }),
  z.object({
    type: z.literal('rectangle'),
    width: z.number().positive(),
    height: z.number().positive(),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
  }),
  z.object({
    type: z.literal('polygon'),
    points: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
  }),
]);

export const StudioAssetFrameSchema = z.object({
  id: SafeIdSchema,
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationMs: z.number().positive().default(100),
  atlasFrameId: SafeIdSchema.optional(),
});

export const StudioAssetHardpointSchema = z.object({
  id: SafeIdSchema,
  kind: z.enum(['primary', 'secondary', 'engine', 'effect', 'attachment']),
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  mirrored: z.boolean().default(false),
});

export const StudioAssetDefinitionSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1),
  kind: StudioAssetKindSchema,
  status: z.enum(['candidate', 'approved', 'rejected']).default('candidate'),
  roles: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  resourceId: SafeIdSchema.optional(),
  sourceKey: z.string().min(1).optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scale: z.number().positive().default(1),
  pivot: z.object({ x: z.number(), y: z.number() }).default({ x: 0.5, y: 0.5 }),
  frames: z.array(StudioAssetFrameSchema).default([]),
  collision: StudioAssetCollisionSchema.optional(),
  hardpoints: z.array(StudioAssetHardpointSchema).default([]),
  presentation: z
    .object({
      altitude: z.number().nonnegative().default(0),
      shadowAssetId: SafeIdSchema.optional(),
      shadowOffsetX: z.number().default(0),
      shadowOffsetY: z.number().default(0),
      shadowScaleX: z.number().positive().default(1),
      shadowScaleY: z.number().positive().default(0.65),
      shadowOpacity: z.number().min(0).max(1).default(0.35),
    })
    .default({
      altitude: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowScaleX: 1,
      shadowScaleY: 0.65,
      shadowOpacity: 0.35,
    }),
  animations: z
    .record(
      z.string(),
      z.object({
        frames: z.array(z.number().int().nonnegative()).min(1),
        fps: z.number().positive(),
        loop: z.boolean().default(true),
      }),
    )
    .default({}),
  atlasFrameIds: z.array(SafeIdSchema).default([]),
});

export const StudioTilesetDefinitionSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1),
  resourceId: SafeIdSchema.optional(),
  tileSize: z.number().int().positive(),
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
  margin: z.number().int().nonnegative().default(0),
  spacing: z.number().int().nonnegative().default(0),
  materialIds: z.array(SafeIdSchema).default([]),
  autotileRule: z
    .enum(['none', 'cardinal', 'blob47', 'dualGrid', 'wang'])
    .default('none'),
  autotileMappings: z.record(z.string(), z.number().int().nonnegative()).default({}),
  tiles: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        materialId: SafeIdSchema.optional(),
        collisionRole: z
          .enum(['none', 'solid', 'hazard', 'slow', 'force'])
          .default('none'),
        animationFrames: z.array(z.number().int().nonnegative()).default([]),
        animationFps: z.number().positive().default(8),
      }),
    )
    .default([]),
});

export const StudioAtlasDefinitionSchema = z.object({
  id: SafeIdSchema,
  displayName: z.string().min(1),
  resourceId: SafeIdSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  padding: z.number().int().nonnegative().default(1),
  frames: z.array(
    z.object({
      id: SafeIdSchema,
      assetId: SafeIdSchema,
      sourceFrame: z.number().int().nonnegative(),
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      pivot: z.object({ x: z.number(), y: z.number() }),
    }),
  ),
});

export const AssetStudioPackageSchema = z.object({
  format: z.literal('skyforge-asset-pack'),
  ...packageBase,
  payload: z.object({
    assets: z.array(StudioAssetDefinitionSchema),
    tilesets: z.array(StudioTilesetDefinitionSchema),
    atlases: z.array(StudioAtlasDefinitionSchema).default([]),
  }),
});

export const StudioPackageSchema = z.union([
  LevelStudioPackageSchema,
  TuningStudioPackageSchema,
  MusicStudioPackageSchema,
  AssetStudioPackageSchema,
]);

export const StudioPackageReferenceSchema = z.object({
  type: StudioPackageTypeSchema,
  id: SafeIdSchema,
  version: SemverSchema,
});

export const StudioWorkspaceSchema = z.object({
  format: z.literal('skyforge-workspace'),
  schemaVersion: z.literal(STUDIO_PACKAGE_SCHEMA_VERSION),
  id: SafeIdSchema,
  name: z.string().min(1),
  version: SemverSchema,
  packages: z.object({
    level: StudioPackageReferenceSchema.extend({ type: z.literal('level') }),
    tuning: StudioPackageReferenceSchema.extend({ type: z.literal('tuning') }),
    music: StudioPackageReferenceSchema.extend({ type: z.literal('music') }),
    asset: StudioPackageReferenceSchema.extend({ type: z.literal('asset') }),
  }),
  activeLevelId: SafeIdSchema.optional(),
  updatedAt: z.string().datetime(),
  reviewComments: z.array(StudioReviewCommentSchema).default([]),
});

export const StudioDependencyLockSchema = z.object({
  format: z.literal('skyforge-lock'),
  schemaVersion: z.literal(1),
  workspace: z.object({
    id: SafeIdSchema,
    version: SemverSchema,
    fingerprint: z.string().min(1),
  }),
  packages: z.array(
    z.object({
      type: StudioPackageTypeSchema,
      id: SafeIdSchema,
      version: SemverSchema,
      contentRevision: z.number().int().positive(),
      fingerprint: z.string().min(1),
      resources: z.array(
        z.object({
          id: SafeIdSchema,
          sha256: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
          bytes: z.number().int().nonnegative().optional(),
        }),
      ),
    }),
  ),
  generatedAt: z.string().datetime(),
  fingerprint: z.string().min(1),
});

export type StudioPackageManifest = z.infer<typeof StudioPackageManifestSchema>;
export type StudioPackageDependency = z.infer<typeof StudioPackageDependencySchema>;
export type StudioReviewComment = z.infer<typeof StudioReviewCommentSchema>;
export type StudioDependencyLock = z.infer<typeof StudioDependencyLockSchema>;
export type StudioPackage = z.infer<typeof StudioPackageSchema>;
export type LevelStudioPackage = z.infer<typeof LevelStudioPackageSchema>;
export type TuningStudioPackage = z.infer<typeof TuningStudioPackageSchema>;
export type MusicStudioPackage = z.infer<typeof MusicStudioPackageSchema>;
export type AssetStudioPackage = z.infer<typeof AssetStudioPackageSchema>;
export type StudioWorkspace = z.infer<typeof StudioWorkspaceSchema>;
export type StudioAssetDefinition = z.infer<typeof StudioAssetDefinitionSchema>;
export type StudioAssetDefinitionInput = z.input<typeof StudioAssetDefinitionSchema>;
export type StudioTilesetDefinitionInput = z.input<typeof StudioTilesetDefinitionSchema>;
export type StudioResource = z.infer<typeof StudioResourceSchema>;
export type StudioTilesetDefinition = z.infer<typeof StudioTilesetDefinitionSchema>;
export type StudioAtlasDefinition = z.infer<typeof StudioAtlasDefinitionSchema>;

export type MusicInstrument = z.infer<typeof MusicInstrumentSchema>;
export type ImportedMusicTrack = z.infer<typeof ImportedMusicTrackSchema>;
export type FmMusicInstrument = Extract<MusicInstrument, { kind: 'fm' }>;
export type SampleMusicInstrument = Extract<MusicInstrument, { kind: 'sample' }>;
export type MusicComposition = z.infer<typeof MusicCompositionSchema>;
export type MusicPattern = z.infer<typeof MusicPatternSchema>;
export type MusicPatternEvent = z.infer<typeof MusicPatternEventSchema>;
export type MusicChannel = z.infer<typeof MusicChannelSchema>;
