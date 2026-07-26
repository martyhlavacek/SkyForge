import {
  StudioPackageSchema,
  StudioWorkspaceSchema,
  type LevelStudioPackage,
  type MusicStudioPackage,
  type StudioPackage,
  type StudioPackageType,
  type StudioResource,
  type StudioWorkspace,
  type TuningStudioPackage,
} from '../../schemas/studioPackageSchema';
import type { MusicCueDef } from '../../schemas/musicSchema';
import { importedTrackCue } from '../../features/levelMusic/ImportedTrackCue';
import { validateStudioPackageSemantics } from '../../studio/PackageValidation';
import { contentRegistry } from './ContentRegistry';

export interface ProductionContentLoadResult {
  loaded: boolean;
  workspaceId?: string;
  activeLevelId?: string;
  packageCount: number;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function replaceMap<T extends { id: string }>(
  target: Map<string, T>,
  values: readonly T[],
): void {
  target.clear();
  values.forEach((value) => target.set(value.id, structuredClone(value)));
}

function selectedPackage<T extends StudioPackage>(
  workspace: StudioWorkspace,
  packages: StudioPackage[],
  type: StudioPackageType,
): T {
  const reference = workspace.packages[type];
  const expectedFormat = `skyforge-${type}-pack`;
  const pkg = packages.find(
    (candidate) =>
      candidate.manifest.id === reference.id &&
      candidate.manifest.version === reference.version &&
      candidate.format === expectedFormat,
  );
  if (!pkg)
    throw new Error(
      `Production content is missing ${type}:${reference.id}@${reference.version}.`,
    );
  return pkg as T;
}

function resourceUrl(resource: StudioResource): string {
  if (resource.embeddedData)
    return `data:${resource.mediaType};base64,${resource.embeddedData}`;
  return resource.uri;
}

function resolvedCue(cue: MusicCueDef, resources: StudioResource[]): MusicCueDef {
  const byUri = new Map(resources.map((resource) => [resource.uri, resource]));
  const resolve = (uri: string): string => {
    const resource = byUri.get(uri);
    return resource ? resourceUrl(resource) : uri;
  };
  return {
    ...structuredClone(cue),
    fullMix: cue.fullMix ? resolve(cue.fullMix) : undefined,
    stems: cue.stems.map((stem) => ({ ...stem, asset: resolve(stem.asset) })),
  };
}

/**
 * Replaces built-in data with a validated compiled Studio package set.
 * Imported tracks become canonical MusicDirector cues before reference
 * validation runs.
 */
export function installProductionContent(
  workspaceInput: unknown,
  packageInputs: unknown[],
): ProductionContentLoadResult {
  const workspace = StudioWorkspaceSchema.parse(workspaceInput);
  const packages = packageInputs.map((value) => StudioPackageSchema.parse(value));
  const semanticIssues = packages.flatMap((pkg) =>
    validateStudioPackageSemantics(pkg).map(
      (issue) => `${pkg.manifest.id}:${issue.path}: ${issue.message}`,
    ),
  );
  if (semanticIssues.length > 0)
    throw new Error(
      `Production package semantics are invalid: ${semanticIssues.join('; ')}`,
    );
  const level = selectedPackage<LevelStudioPackage>(workspace, packages, 'level');
  const tuning = selectedPackage<TuningStudioPackage>(workspace, packages, 'tuning');
  const music = selectedPackage<MusicStudioPackage>(workspace, packages, 'music');

  replaceMap(contentRegistry.levels, level.payload.levels);
  replaceMap(contentRegistry.levelPackages, level.payload.levelPackages);
  replaceMap(contentRegistry.terrainMaps, level.payload.maps);
  replaceMap(contentRegistry.terrainCollisions, level.payload.collisions);
  replaceMap(contentRegistry.routeSets, level.payload.routes);
  replaceMap(contentRegistry.terrainObjects, level.payload.objects);
  replaceMap(contentRegistry.biomes, level.payload.biomes);

  replaceMap(contentRegistry.enemies, tuning.payload.enemies);
  replaceMap(contentRegistry.weapons, tuning.payload.weapons);
  replaceMap(contentRegistry.projectilePatterns, tuning.payload.projectilePatterns);
  replaceMap(contentRegistry.movement, tuning.payload.movementPatterns);
  replaceMap(contentRegistry.formations, tuning.payload.formations);
  replaceMap(contentRegistry.encounters, tuning.payload.encounters);
  replaceMap(contentRegistry.bosses, tuning.payload.bosses);
  replaceMap(contentRegistry.pickups, tuning.payload.pickups);
  replaceMap(contentRegistry.equipment, tuning.payload.equipment);
  contentRegistry.difficulty = structuredClone(tuning.payload.difficulty);

  contentRegistry.music.clear();
  music.payload.cues.forEach((cue) =>
    contentRegistry.music.set(cue.id, resolvedCue(cue, music.resources)),
  );
  const resourcesById = new Map(
    music.resources.map((resource) => [resource.id, resource]),
  );
  music.payload.tracks.forEach((track) => {
    const resource = resourcesById.get(track.resourceId);
    if (!resource)
      throw new Error(
        `Imported music track ${track.id} is missing resource ${track.resourceId}.`,
      );
    if (!contentRegistry.music.has(track.id))
      contentRegistry.music.set(
        track.id,
        importedTrackCue(track, resourceUrl(resource)),
      );
  });

  contentRegistry.errors.length = 0;
  contentRegistry.validateReferences();
  if (contentRegistry.errors.length > 0)
    throw new Error(
      `Production content failed reference validation: ${contentRegistry.errors
        .map((issue) => `${issue.file}: ${issue.message}`)
        .join('; ')}`,
    );

  return {
    loaded: true,
    workspaceId: workspace.id,
    activeLevelId: workspace.activeLevelId,
    packageCount: packages.length,
  };
}

async function fetchJson(
  fetcher: FetchLike,
  url: string,
  optional: boolean,
): Promise<unknown | undefined> {
  const response = await fetcher(url, { cache: 'no-store' });
  if (response.status === 404 && optional) return undefined;
  if (!response.ok)
    throw new Error(`Production content request failed (${response.status}): ${url}`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (optional && !contentType.includes('json')) return undefined;
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `Production content is not valid JSON at ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

class ProductionContentRuntime {
  private result: ProductionContentLoadResult = {
    loaded: false,
    packageCount: 0,
  };

  get activeLevelId(): string | undefined {
    return this.result.activeLevelId;
  }

  get state(): ProductionContentLoadResult {
    return { ...this.result };
  }

  async load(
    baseUrl = import.meta.env.BASE_URL || '/',
    fetcher: FetchLike = fetch,
  ): Promise<ProductionContentLoadResult> {
    const root = new URL(baseUrl, window.location.origin);
    const releaseUrl = new URL('release-manifest.json', root).toString();
    const release = await fetchJson(fetcher, releaseUrl, true);
    if (!release) return this.state;
    if (
      typeof release !== 'object' ||
      release === null ||
      (release as { format?: unknown }).format !== 'skyforge-production-build'
    )
      throw new Error('release-manifest.json is not a SkyForge production build.');

    const workspaceUrl = new URL('content/workspace.json', root).toString();
    const workspaceInput = await fetchJson(fetcher, workspaceUrl, false);
    const workspace = StudioWorkspaceSchema.parse(workspaceInput);
    const packageInputs = await Promise.all(
      Object.entries(workspace.packages).map(([type, reference]) =>
        fetchJson(
          fetcher,
          new URL(
            `content/packages/${type}-${reference.id}-${reference.version}.json`,
            root,
          ).toString(),
          false,
        ),
      ),
    );
    this.result = installProductionContent(workspace, packageInputs);
    return this.state;
  }
}

export const productionContent = new ProductionContentRuntime();
