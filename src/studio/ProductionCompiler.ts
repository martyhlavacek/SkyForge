import type {
  AssetStudioPackage,
  MusicStudioPackage,
  StudioDependencyLock,
  StudioPackage,
  StudioResource,
  StudioWorkspace,
} from '../schemas/studioPackageSchema';
import { base64ToBytes, sha256Hex } from './assets/AssetResourceTools';
import { compileStudioWorkspace, type StudioCompileIssue } from './ContentCompiler';
import { validateDependencyLock } from './DependencyLock';
import { contentFingerprint } from './PackageCodec';
import { packageTypeOf } from './PackageTypes';

export interface ProductionResourceArtifact {
  packageKey: string;
  resourceId: string;
  sourceUri: string;
  targetPath: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  embedded: boolean;
  data?: Uint8Array;
}

export interface ProductionBuildManifest {
  format: 'skyforge-production-build';
  schemaVersion: 1;
  workspaceId: string;
  workspaceVersion: string;
  contentFingerprint: string;
  lockFingerprint?: string;
  generatedAt: string;
  packages: string[];
  activeLevelId?: string;
  resources: Omit<ProductionResourceArtifact, 'data'>[];
  removedResources: { packageKey: string; resourceId: string; reason: string }[];
  atlases: {
    packageKey: string;
    id: string;
    resourceId: string;
    width: number;
    height: number;
    frames: number;
  }[];
}

export interface ProductionCompileResult {
  manifest?: ProductionBuildManifest;
  artifacts: ProductionResourceArtifact[];
  issues: StudioCompileIssue[];
}

export interface ProductionCompilerOptions {
  generatedAt?: string;
  baseUrl?: string;
  includeData?: boolean;
  fetchResource?: (uri: string) => Promise<Uint8Array>;
  requireLock?: boolean;
}

function sanitizeFilename(value: string): string {
  return (
    value
      .replace(/[/\\]+/g, '-')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'resource.bin'
  );
}

function referencedAssetResources(pkg: AssetStudioPackage): Set<string> {
  const ids = new Set<string>();
  pkg.payload.assets.forEach((asset) => asset.resourceId && ids.add(asset.resourceId));
  pkg.payload.tilesets.forEach(
    (tileset) => tileset.resourceId && ids.add(tileset.resourceId),
  );
  pkg.payload.atlases.forEach((atlas) => ids.add(atlas.resourceId));
  return ids;
}

function referencedMusicResources(pkg: MusicStudioPackage): Set<string> {
  const ids = new Set<string>();
  const byUri = new Map(pkg.resources.map((resource) => [resource.uri, resource.id]));
  pkg.payload.cues.forEach((cue) => {
    [cue.fullMix, ...cue.stems.map((stem) => stem.asset)]
      .filter((uri): uri is string => Boolean(uri))
      .forEach((uri) => {
        const id = byUri.get(uri);
        if (id) ids.add(id);
      });
  });
  pkg.payload.instruments.forEach((instrument) => {
    if (instrument.kind === 'sample') ids.add(instrument.resourceId);
  });
  return ids;
}

function referencedResourceIds(pkg: StudioPackage): Set<string> {
  if (pkg.format === 'skyforge-asset-pack') return referencedAssetResources(pkg);
  if (pkg.format === 'skyforge-music-pack') return referencedMusicResources(pkg);
  return new Set(pkg.resources.map((resource) => resource.id));
}

async function defaultFetch(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function resourceBytes(
  resource: StudioResource,
  options: ProductionCompilerOptions,
): Promise<Uint8Array> {
  if (resource.embeddedData) return base64ToBytes(resource.embeddedData);
  const fetcher = options.fetchResource ?? defaultFetch;
  const uri = /^https?:/i.test(resource.uri)
    ? resource.uri
    : `${options.baseUrl ?? ''}${resource.uri.replace(/^\//, '')}`;
  return fetcher(uri);
}

export async function compileProductionWorkspace(
  workspace: StudioWorkspace,
  packages: StudioPackage[],
  lock?: StudioDependencyLock,
  options: ProductionCompilerOptions = {},
): Promise<ProductionCompileResult> {
  const base = compileStudioWorkspace(workspace, packages);
  const issues: StudioCompileIssue[] = [...base.issues];
  if (options.requireLock && !lock)
    issues.push({
      severity: 'error',
      code: 'missing-package',
      file: 'skyforge.lock',
      message: 'production compilation requires a dependency lock',
    });
  if (lock)
    validateDependencyLock(lock, workspace, packages).forEach((issue) =>
      issues.push({
        severity: issue.severity,
        code: 'version-mismatch',
        packageKey: issue.packageKey,
        file: 'skyforge.lock',
        message: issue.message,
      }),
    );
  packages.forEach((pkg) => {
    pkg.reviewComments
      .filter((comment) => comment.status === 'open' && comment.severity === 'blocking')
      .forEach((comment) =>
        issues.push({
          severity: 'error',
          code: 'version-mismatch',
          packageKey: `${packageTypeOf(pkg)}:${pkg.manifest.id}`,
          file: comment.targetPath,
          message: `unresolved blocking review comment: ${comment.body}`,
        }),
      );
  });
  if (!base.build || issues.some((issue) => issue.severity === 'error'))
    return { artifacts: [], issues };

  const artifacts: ProductionResourceArtifact[] = [];
  const removedResources: ProductionBuildManifest['removedResources'] = [];
  for (const pkg of packages) {
    const key = `${packageTypeOf(pkg)}:${pkg.manifest.id}`;
    const referenced = referencedResourceIds(pkg);
    for (const resource of pkg.resources) {
      if (!referenced.has(resource.id)) {
        removedResources.push({
          packageKey: key,
          resourceId: resource.id,
          reason: 'unreferenced by compiled package content',
        });
        continue;
      }
      try {
        const data = await resourceBytes(resource, options);
        const sha256 = await sha256Hex(data);
        if (resource.sha256 && resource.sha256 !== sha256) {
          issues.push({
            severity: 'error',
            code: 'version-mismatch',
            packageKey: key,
            file: `resources/${resource.id}`,
            message: `SHA-256 mismatch: expected ${resource.sha256}, received ${sha256}`,
          });
          continue;
        }
        if (resource.bytes !== undefined && resource.bytes !== data.byteLength) {
          issues.push({
            severity: 'error',
            code: 'version-mismatch',
            packageKey: key,
            file: `resources/${resource.id}`,
            message: `byte count mismatch: expected ${resource.bytes}, received ${data.byteLength}`,
          });
          continue;
        }
        const filename = sanitizeFilename(
          resource.filename ?? resource.uri.split('/').pop() ?? `${resource.id}.bin`,
        );
        artifacts.push({
          packageKey: key,
          resourceId: resource.id,
          sourceUri: resource.uri,
          targetPath: `resources/${packageTypeOf(pkg)}/${sha256.slice(0, 16)}-${filename}`,
          mediaType: resource.mediaType,
          bytes: data.byteLength,
          sha256,
          embedded: Boolean(resource.embeddedData),
          data: options.includeData ? data : undefined,
        });
      } catch (error) {
        issues.push({
          severity: 'error',
          code: 'missing-package',
          packageKey: key,
          file: `resources/${resource.id}`,
          message: `resource could not be compiled: ${String(error)}`,
        });
      }
    }
  }
  if (issues.some((issue) => issue.severity === 'error')) return { artifacts, issues };

  const atlasEntries = packages.flatMap((pkg) =>
    pkg.format === 'skyforge-asset-pack'
      ? pkg.payload.atlases.map((atlas) => ({
          packageKey: `${packageTypeOf(pkg)}:${pkg.manifest.id}`,
          id: atlas.id,
          resourceId: atlas.resourceId,
          width: atlas.width,
          height: atlas.height,
          frames: atlas.frames.length,
        }))
      : [],
  );
  const manifestBase = {
    workspaceId: workspace.id,
    workspaceVersion: workspace.version,
    contentFingerprint: base.build.fingerprint,
    lockFingerprint: lock?.fingerprint,
    packages: base.build.packageOrder,
    activeLevelId: base.build.activeLevelId,
    resources: artifacts
      .map(({ data: _data, ...artifact }) => artifact)
      .sort((a, b) => a.targetPath.localeCompare(b.targetPath)),
    removedResources: removedResources.sort((a, b) =>
      `${a.packageKey}:${a.resourceId}`.localeCompare(`${b.packageKey}:${b.resourceId}`),
    ),
    atlases: atlasEntries.sort((a, b) => a.id.localeCompare(b.id)),
  };
  return {
    artifacts,
    issues,
    manifest: {
      format: 'skyforge-production-build',
      schemaVersion: 1,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      ...manifestBase,
      contentFingerprint: contentFingerprint(manifestBase),
    },
  };
}
