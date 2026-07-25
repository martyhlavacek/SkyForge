import type {
  AssetStudioPackage,
  LevelStudioPackage,
  MusicStudioPackage,
  StudioPackage,
  StudioWorkspace,
  TuningStudioPackage,
} from '../schemas/studioPackageSchema';
import { contentFingerprint } from './PackageCodec';
import { packageTypeOf } from './PackageTypes';
import { validateStudioPackageSemantics } from './PackageValidation';
import { resolveStudioWorkspace, type StudioResolutionIssue } from './DependencyResolver';

export interface StudioCompileIssue extends StudioResolutionIssue {
  file?: string;
}

export interface CompiledStudioBuild {
  format: 'skyforge-compiled-content';
  schemaVersion: 1;
  workspaceId: string;
  workspaceVersion: string;
  fingerprint: string;
  packageOrder: string[];
  activeLevelId?: string;
  content: {
    levelIds: string[];
    tuningProfileId: string;
    musicCueIds: string[];
    assetIds: string[];
    tilesetIds: string[];
    atlasIds: string[];
    assetResourceIds: string[];
  };
}

export interface StudioCompileResult {
  build?: CompiledStudioBuild;
  issues: StudioCompileIssue[];
}

function findPackage<T extends StudioPackage>(
  packages: StudioPackage[],
  type: ReturnType<typeof packageTypeOf>,
): T | undefined {
  return packages.find((pkg) => packageTypeOf(pkg) === type) as T | undefined;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  ids.forEach((id) => (seen.has(id) ? duplicate.add(id) : seen.add(id)));
  return [...duplicate];
}

export function compileStudioWorkspace(
  workspace: StudioWorkspace,
  packages: StudioPackage[],
): StudioCompileResult {
  const resolution = resolveStudioWorkspace(workspace, packages);
  const issues: StudioCompileIssue[] = [...resolution.issues];
  packages.forEach((pkg) => {
    validateStudioPackageSemantics(pkg).forEach((issue) =>
      issues.push({
        severity: 'error',
        code: 'duplicate-package',
        packageKey: `${packageTypeOf(pkg)}:${pkg.manifest.id}`,
        file: issue.path,
        message: issue.message,
      }),
    );
  });
  if (issues.some((issue) => issue.severity === 'error')) return { issues };

  const level = findPackage<LevelStudioPackage>(resolution.ordered, 'level');
  const tuning = findPackage<TuningStudioPackage>(resolution.ordered, 'tuning');
  const music = findPackage<MusicStudioPackage>(resolution.ordered, 'music');
  const asset = findPackage<AssetStudioPackage>(resolution.ordered, 'asset');
  if (!level || !tuning || !music || !asset) {
    issues.push({
      severity: 'error',
      code: 'missing-package',
      message: 'compiler requires one level, tuning, music, and asset package',
    });
    return { issues };
  }

  const groups: [string, string[]][] = [
    ['levels', level.payload.levels.map((item) => item.id)],
    ['enemies', tuning.payload.enemies.map((item) => item.id)],
    ['weapons', tuning.payload.weapons.map((item) => item.id)],
    ['encounters', tuning.payload.encounters.map((item) => item.id)],
    ['equipment', tuning.payload.equipment.map((item) => item.id)],
    ['music cues', music.payload.cues.map((item) => item.id)],
    ['assets', asset.payload.assets.map((item) => item.id)],
    ['tilesets', asset.payload.tilesets.map((item) => item.id)],
  ];
  groups.forEach(([group, ids]) => {
    duplicates(ids).forEach((id) =>
      issues.push({
        severity: 'error',
        code: 'duplicate-package',
        file: group,
        message: `duplicate ${group} id "${id}"`,
      }),
    );
  });

  const cueIds = new Set(music.payload.cues.map((cue) => cue.id));
  const trackIds = new Set(music.payload.tracks.map((track) => track.id));
  level.payload.levels.forEach((definition) => {
    if (!cueIds.has(definition.music)) {
      issues.push({
        severity: 'error',
        code: 'missing-package',
        file: `levels/${definition.id}`,
        message: `music cue "${definition.music}" is not supplied by the music pack`,
      });
    }
    if (definition.levelMusic?.trackId && !trackIds.has(definition.levelMusic.trackId)) {
      issues.push({
        severity: 'error',
        code: 'missing-package',
        file: `levels/${definition.id}`,
        message: `music track "${definition.levelMusic.trackId}" is not supplied by the music pack`,
      });
    }
  });

  const assetIds = new Set(asset.payload.assets.map((definition) => definition.id));
  const assetsById = new Map(
    asset.payload.assets.map((definition) => [definition.id, definition]),
  );
  tuning.payload.enemies.forEach((enemy) => {
    if (!assetIds.has(enemy.sprite)) {
      issues.push({
        severity: 'error',
        code: 'missing-package',
        file: `enemies/${enemy.id}`,
        message: `sprite asset "${enemy.sprite}" is not supplied by the asset pack`,
      });
    } else {
      const definition = assetsById.get(enemy.sprite);
      if (definition?.status === 'rejected') {
        issues.push({
          severity: 'error',
          code: 'missing-package',
          file: `enemies/${enemy.id}`,
          message: `sprite asset "${enemy.sprite}" is rejected`,
        });
      } else if (definition?.status === 'candidate') {
        issues.push({
          severity: 'warning',
          code: 'missing-package',
          file: `enemies/${enemy.id}`,
          message: `sprite asset "${enemy.sprite}" is still a candidate`,
        });
      }
    }
  });
  tuning.payload.equipment.forEach((equipment) => {
    if (!assetIds.has(equipment.iconKey)) {
      issues.push({
        severity: 'warning',
        code: 'missing-package',
        file: `equipment/${equipment.id}`,
        message: `icon asset "${equipment.iconKey}" is not supplied by the asset pack`,
      });
    }
  });

  if (
    workspace.activeLevelId &&
    !level.payload.levels.some((item) => item.id === workspace.activeLevelId)
  ) {
    issues.push({
      severity: 'error',
      code: 'missing-package',
      file: 'workspace',
      message: `active level "${workspace.activeLevelId}" is not present in the level pack`,
    });
  }

  if (issues.some((issue) => issue.severity === 'error')) return { issues };

  const packageOrder = resolution.ordered.map(
    (pkg) => `${packageTypeOf(pkg)}:${pkg.manifest.id}@${pkg.manifest.version}`,
  );
  const summary = {
    workspace,
    packageOrder,
    packageFingerprints: resolution.ordered.map((pkg) => contentFingerprint(pkg)),
  };
  return {
    issues,
    build: {
      format: 'skyforge-compiled-content',
      schemaVersion: 1,
      workspaceId: workspace.id,
      workspaceVersion: workspace.version,
      fingerprint: contentFingerprint(summary),
      packageOrder,
      activeLevelId: workspace.activeLevelId,
      content: {
        levelIds: level.payload.levels.map((item) => item.id),
        tuningProfileId: tuning.payload.profileId,
        musicCueIds: music.payload.cues.map((item) => item.id),
        assetIds: asset.payload.assets.map((item) => item.id),
        tilesetIds: asset.payload.tilesets.map((item) => item.id),
        atlasIds: asset.payload.atlases.map((item) => item.id),
        assetResourceIds: asset.resources.map((item) => item.id),
      },
    },
  };
}
