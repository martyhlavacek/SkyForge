import { contentRegistry } from '../game/systems/ContentRegistry';
import { LevelSchema, type LevelDef, type LevelEvent } from '../schemas/levelSchema';
import type { ValidationError } from '../schemas/validation';

export interface WorkingEvent {
  editorId: string;
  value: LevelEvent;
}

export type WorkingLevel = Omit<LevelDef, 'events'> & { events: WorkingEvent[] };

function makeEditorId(index: number): string {
  return globalThis.crypto?.randomUUID?.() ?? `event-${Date.now()}-${index}`;
}

export function cloneLevel(level: LevelDef): WorkingLevel {
  const copy = structuredClone(level);
  return {
    ...copy,
    events: copy.events.map((value, index) => ({ editorId: makeEditorId(index), value })),
  };
}

export function toLevelDef(level: WorkingLevel): LevelDef {
  return {
    ...structuredClone(level),
    events: level.events
      .map((event) => structuredClone(event.value))
      .sort((a, b) => a.at - b.at),
  };
}

export function availableLevels(): { id: string; displayName: string }[] {
  return [...contentRegistry.levels.values()].map((level) => ({
    id: level.id,
    displayName: level.displayName,
  }));
}

export function availableEncounters(): string[] {
  return [...contentRegistry.encounters.keys()].sort();
}

export function parseLevel(json: string): { level?: WorkingLevel; error?: string } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    return { error: `JSON parse error: ${(error as Error).message}` };
  }
  const result = LevelSchema.safeParse(data);
  if (!result.success) {
    return {
      error: result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n'),
    };
  }
  return { level: cloneLevel(result.data) };
}

export function serializeLevel(level: WorkingLevel): string {
  return `${JSON.stringify(toLevelDef(level), null, 2)}\n`;
}

export function validateWorkingLevel(level: WorkingLevel): ValidationError[] {
  const errors: ValidationError[] = [];
  const raw = toLevelDef(level);
  const file = `${level.id}.json`;
  const shape = LevelSchema.safeParse(raw);
  if (!shape.success) {
    shape.error.issues.forEach((issue) =>
      errors.push({
        file,
        message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      }),
    );
  }

  raw.events.forEach((event, index) => {
    if ('encounter' in event && !contentRegistry.encounters.has(event.encounter)) {
      errors.push({
        file,
        message: `events[${index}].encounter "${event.encounter}" not found`,
      });
    }
    if ('type' in event && event.type === 'terrainState') {
      const packageDef = raw.levelPackage
        ? contentRegistry.levelPackages.get(raw.levelPackage)
        : undefined;
      const objectSet = packageDef
        ? contentRegistry.terrainObjects.get(packageDef.objectSetId)
        : undefined;
      if (!objectSet?.objects.some((object) => object.id === event.target)) {
        errors.push({
          file,
          message: `events[${index}].target "${event.target}" not found`,
        });
      }
    }
  });

  const seen = new Set<string>();
  for (const object of raw.groundObjects) {
    if (seen.has(object.id))
      errors.push({ file, message: `duplicate groundObject id "${object.id}"` });
    seen.add(object.id);
  }
  return errors;
}

const AUTOSAVE_KEY_PREFIX = 'skyforge_editor_level_';
const LAST_LEVEL_KEY = 'skyforge_editor_last_level';

export function autosave(level: WorkingLevel): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY_PREFIX + level.id, JSON.stringify(level));
    localStorage.setItem(LAST_LEVEL_KEY, level.id);
  } catch {
    // Storage is optional.
  }
}

export function loadAutosave(levelId?: string): WorkingLevel | null {
  try {
    const id = levelId ?? localStorage.getItem(LAST_LEVEL_KEY);
    if (!id) return null;
    const raw = localStorage.getItem(AUTOSAVE_KEY_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'events' in parsed &&
      Array.isArray((parsed as { events: unknown[] }).events) &&
      (parsed as { events: unknown[] }).events.every(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          'editorId' in event &&
          'value' in event,
      )
    ) {
      const candidate = parsed as WorkingLevel;
      return LevelSchema.safeParse(toLevelDef(candidate)).success ? candidate : null;
    }
    const legacy = LevelSchema.safeParse(parsed);
    return legacy.success ? cloneLevel(legacy.data) : null;
  } catch {
    return null;
  }
}

const PREVIEW_KEY_PREFIX = 'skyforge_preview_level_';

export function stashForPreview(level: WorkingLevel): void {
  try {
    localStorage.setItem(
      PREVIEW_KEY_PREFIX + level.id,
      JSON.stringify(toLevelDef(level)),
    );
  } catch {
    // Preview remains optional when storage is disabled.
  }
}

export function previewKeyFor(levelId: string): string {
  return PREVIEW_KEY_PREFIX + levelId;
}
