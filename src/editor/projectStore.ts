import { contentRegistry } from '../game/systems/ContentRegistry';
import { LevelSchema, type LevelDef } from '../schemas/levelSchema';
import {
  BiomeSchema,
  LevelPackageSchema,
  RouteSetSchema,
  TerrainCollisionSchema,
  TerrainMapSchema,
  TerrainObjectSetSchema,
  type BiomeDef,
  type LevelPackageDef,
  type RouteSetDef,
  type TerrainCollisionDef,
  type TerrainMapDef,
  type TerrainObjectSetDef,
} from '../schemas/terrainSchema';
import type { ValidationError } from '../schemas/validation';
import { analyzeRoutes } from '../game/terrain/TerrainAnalysis';
import {
  cloneLevel,
  toLevelDef,
  validateWorkingLevel,
  type WorkingLevel,
} from './levelStore';

export interface EditorProject {
  level: WorkingLevel;
  packageDef?: LevelPackageDef;
  map?: TerrainMapDef;
  collision?: TerrainCollisionDef;
  routes?: RouteSetDef;
  objects?: TerrainObjectSetDef;
  biome?: BiomeDef;
}

export function createEditorProject(level: LevelDef): EditorProject {
  const project: EditorProject = { level: cloneLevel(level) };
  if (!level.levelPackage) return project;
  const packageDef = contentRegistry.levelPackages.get(level.levelPackage);
  if (!packageDef) return project;
  return {
    level: cloneLevel(level),
    packageDef: structuredClone(packageDef),
    map: structuredClone(contentRegistry.terrainMaps.get(packageDef.mapId)),
    collision: structuredClone(
      contentRegistry.terrainCollisions.get(packageDef.collisionId),
    ),
    routes: structuredClone(contentRegistry.routeSets.get(packageDef.routeSetId)),
    objects: structuredClone(contentRegistry.terrainObjects.get(packageDef.objectSetId)),
    biome: structuredClone(contentRegistry.biomes.get(packageDef.biomeId)),
  };
}

export function validateEditorProject(
  project: EditorProject,
  shipRadius = 18,
): ValidationError[] {
  const errors = validateWorkingLevel(project.level);
  if (project.level.levelPackage || project.packageDef) {
    const required: [string, unknown][] = [
      ['manifest.json', project.packageDef],
      ['map.json', project.map],
      ['collision.json', project.collision],
      ['routes.json', project.routes],
      ['objects.json', project.objects],
      ['biome.json', project.biome],
    ];
    required.forEach(([file, value]) => {
      if (!value) errors.push({ file, message: 'required Level Package v2 file is missing' });
    });
  }
  const checks: [
    string,
    unknown,
    {
      safeParse(value: unknown): {
        success: boolean;
        error?: { issues: { path: PropertyKey[]; message: string }[] };
      };
    },
  ][] = [
    ['manifest.json', project.packageDef, LevelPackageSchema],
    ['map.json', project.map, TerrainMapSchema],
    ['collision.json', project.collision, TerrainCollisionSchema],
    ['routes.json', project.routes, RouteSetSchema],
    ['objects.json', project.objects, TerrainObjectSetSchema],
    ['biome.json', project.biome, BiomeSchema],
  ];
  for (const [file, value, schema] of checks) {
    if (!value) continue;
    const result = schema.safeParse(value);
    if (!result.success && result.error) {
      result.error.issues.forEach((issue) =>
        errors.push({
          file,
          message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        }),
      );
    }
  }
  if (project.collision && project.routes) {
    const analysis = analyzeRoutes(project.collision, project.routes, shipRadius);
    analysis.issues
      .filter((issue) => issue.severity === 'error')
      .forEach((issue) =>
        errors.push({
          file: 'routes.json',
          message: `${issue.routeId} @ ${issue.worldY}: ${issue.message}`,
        }),
      );
  }
  return errors;
}

export function projectDownloads(
  project: EditorProject,
): { name: string; text: string }[] {
  const files = [
    {
      name: `${project.level.id}.json`,
      text: `${JSON.stringify(toLevelDef(project.level), null, 2)}\n`,
    },
  ];
  if (project.packageDef)
    files.push({
      name: `${project.packageDef.id}.json`,
      text: `${JSON.stringify(project.packageDef, null, 2)}\n`,
    });
  if (project.map)
    files.push({
      name: `${project.map.id}.json`,
      text: `${JSON.stringify(project.map, null, 2)}\n`,
    });
  if (project.collision)
    files.push({
      name: `${project.collision.id}.json`,
      text: `${JSON.stringify(project.collision, null, 2)}\n`,
    });
  if (project.routes)
    files.push({
      name: `${project.routes.id}.json`,
      text: `${JSON.stringify(project.routes, null, 2)}\n`,
    });
  if (project.objects)
    files.push({
      name: `${project.objects.id}.json`,
      text: `${JSON.stringify(project.objects, null, 2)}\n`,
    });
  if (project.biome)
    files.push({
      name: `${project.biome.id}.json`,
      text: `${JSON.stringify(project.biome, null, 2)}\n`,
    });
  return files;
}

export interface ProjectImportFile {
  name: string;
  text: string;
}

export interface ProjectImportResult {
  project?: EditorProject;
  errors: ValidationError[];
}

/** Parses an exported multi-file Level Package v2 without mutating the registry. */
export function parseProjectPackage(files: ProjectImportFile[]): ProjectImportResult {
  let level: LevelDef | undefined;
  let packageDef: LevelPackageDef | undefined;
  let map: TerrainMapDef | undefined;
  let collision: TerrainCollisionDef | undefined;
  let routes: RouteSetDef | undefined;
  let objects: TerrainObjectSetDef | undefined;
  let biome: BiomeDef | undefined;
  const errors: ValidationError[] = [];

  for (const file of files) {
    let value: unknown;
    try {
      value = JSON.parse(file.text);
    } catch (error) {
      errors.push({ file: file.name, message: `invalid JSON: ${String(error)}` });
      continue;
    }
    if (!value || typeof value !== 'object') {
      errors.push({ file: file.name, message: 'root must be an object' });
      continue;
    }
    const record = value as Record<string, unknown>;
    const candidates =
      'events' in record
        ? [[LevelSchema, (parsed: LevelDef) => (level = parsed)] as const]
        : 'layers' in record
          ? [[TerrainMapSchema, (parsed: TerrainMapDef) => (map = parsed)] as const]
          : 'corridor' in record
            ? [[TerrainCollisionSchema, (parsed: TerrainCollisionDef) => (collision = parsed)] as const]
            : 'routes' in record
              ? [[RouteSetSchema, (parsed: RouteSetDef) => (routes = parsed)] as const]
              : 'objects' in record
                ? [[TerrainObjectSetSchema, (parsed: TerrainObjectSetDef) => (objects = parsed)] as const]
                : 'materials' in record
                  ? [[BiomeSchema, (parsed: BiomeDef) => (biome = parsed)] as const]
                  : 'levelId' in record && 'mapId' in record
                    ? [[LevelPackageSchema, (parsed: LevelPackageDef) => (packageDef = parsed)] as const]
                    : [];
    if (candidates.length === 0) {
      errors.push({ file: file.name, message: 'unrecognized Level Package v2 document' });
      continue;
    }
    const [schema, assign] = candidates[0];
    const result = schema.safeParse(value);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        errors.push({
          file: file.name,
          message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        }),
      );
      continue;
    }
    assign(result.data as never);
  }

  if (!level) errors.push({ file: 'level.json', message: 'package contains no level definition' });
  if (errors.length || !level) return { errors };
  const project: EditorProject = {
    level: cloneLevel(level),
    packageDef,
    map,
    collision,
    routes,
    objects,
    biome,
  };
  errors.push(...validateEditorProject(project));
  return errors.length ? { errors } : { project, errors: [] };
}

const PROJECT_AUTOSAVE_PREFIX = 'skyforge_editor_project_';
const PROJECT_PREVIEW_PREFIX = 'skyforge_preview_project_';

export function autosaveProject(project: EditorProject): void {
  try {
    localStorage.setItem(
      PROJECT_AUTOSAVE_PREFIX + project.level.id,
      JSON.stringify(project),
    );
  } catch {
    // Storage is optional.
  }
}

export function loadProjectAutosave(levelId: string): EditorProject | null {
  try {
    const raw = localStorage.getItem(PROJECT_AUTOSAVE_PREFIX + levelId);
    if (!raw) return null;
    const project = JSON.parse(raw) as EditorProject;
    return validateWorkingLevel(project.level).length === 0 ? project : null;
  } catch {
    return null;
  }
}

export function stashProjectForPreview(project: EditorProject): void {
  try {
    localStorage.setItem(
      PROJECT_PREVIEW_PREFIX + project.level.id,
      JSON.stringify({
        packageDef: project.packageDef,
        map: project.map,
        collision: project.collision,
        routes: project.routes,
        objects: project.objects,
        biome: project.biome,
      }),
    );
  } catch {
    // Preview falls back to canonical content.
  }
}

export function projectPreviewKey(levelId: string): string {
  return PROJECT_PREVIEW_PREFIX + levelId;
}
