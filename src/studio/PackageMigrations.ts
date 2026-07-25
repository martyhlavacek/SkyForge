import {
  STUDIO_PACKAGE_SCHEMA_VERSION,
  StudioPackageSchema,
  StudioWorkspaceSchema,
  type StudioPackage,
  type StudioWorkspace,
} from '../schemas/studioPackageSchema';

export interface MigrationStepReport {
  fromVersion: number;
  toVersion: number;
  changes: string[];
}

export interface MigrationResult<T> {
  value: T;
  migrated: boolean;
  steps: MigrationStepReport[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function packageV1ToV2(raw: JsonRecord): JsonRecord {
  const manifest = isRecord(raw.manifest) ? { ...raw.manifest } : {};
  return {
    ...raw,
    schemaVersion: 2,
    manifest: {
      ...manifest,
      contentRevision:
        typeof manifest.contentRevision === 'number' ? manifest.contentRevision : 1,
    },
    reviewComments: Array.isArray(raw.reviewComments) ? raw.reviewComments : [],
  };
}

function workspaceV1ToV2(raw: JsonRecord): JsonRecord {
  return {
    ...raw,
    schemaVersion: 2,
    reviewComments: Array.isArray(raw.reviewComments) ? raw.reviewComments : [],
  };
}

export function migrateStudioPackage(raw: unknown): MigrationResult<StudioPackage> {
  if (!isRecord(raw)) throw new Error('Studio package must be a JSON object');
  let candidate: JsonRecord = structuredClone(raw);
  const steps: MigrationStepReport[] = [];
  const version = Number(candidate.schemaVersion ?? 1);
  if (!Number.isInteger(version) || version < 1)
    throw new Error(
      `Unsupported Studio package schema version ${String(candidate.schemaVersion)}`,
    );
  if (version > STUDIO_PACKAGE_SCHEMA_VERSION)
    throw new Error(
      `Package schema ${version} is newer than supported schema ${STUDIO_PACKAGE_SCHEMA_VERSION}`,
    );
  if (version === 1) {
    candidate = packageV1ToV2(candidate);
    steps.push({
      fromVersion: 1,
      toVersion: 2,
      changes: [
        'added manifest.contentRevision with default value 1',
        'added package reviewComments collection',
      ],
    });
  }
  return {
    value: StudioPackageSchema.parse(candidate),
    migrated: steps.length > 0,
    steps,
  };
}

export function migrateStudioWorkspace(raw: unknown): MigrationResult<StudioWorkspace> {
  if (!isRecord(raw)) throw new Error('Studio workspace must be a JSON object');
  let candidate: JsonRecord = structuredClone(raw);
  const steps: MigrationStepReport[] = [];
  const version = Number(candidate.schemaVersion ?? 1);
  if (!Number.isInteger(version) || version < 1)
    throw new Error(
      `Unsupported Studio workspace schema version ${String(candidate.schemaVersion)}`,
    );
  if (version > STUDIO_PACKAGE_SCHEMA_VERSION)
    throw new Error(
      `Workspace schema ${version} is newer than supported schema ${STUDIO_PACKAGE_SCHEMA_VERSION}`,
    );
  if (version === 1) {
    candidate = workspaceV1ToV2(candidate);
    steps.push({
      fromVersion: 1,
      toVersion: 2,
      changes: ['added workspace reviewComments collection'],
    });
  }
  return {
    value: StudioWorkspaceSchema.parse(candidate),
    migrated: steps.length > 0,
    steps,
  };
}
