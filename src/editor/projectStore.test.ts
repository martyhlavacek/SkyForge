import { describe, expect, it } from 'vitest';
import { contentRegistry } from '../game/systems/ContentRegistry';
import {
  createEditorProject,
  parseProjectPackage,
  projectDownloads,
  validateEditorProject,
} from './projectStore';

describe('Level Package v2 editor workflow', () => {
  it('round-trips a canonical project through multi-file export and import', () => {
    const level = contentRegistry.levels.get('level_01');
    if (!level) throw new Error('missing level_01');
    const project = createEditorProject(level);
    const downloads = projectDownloads(project);
    const parsed = parseProjectPackage(downloads);

    expect(parsed.errors).toEqual([]);
    expect(parsed.project?.level.id).toBe('level_01');
    expect(parsed.project?.packageDef?.id).toBe('level_01_canyon');
    expect(parsed.project?.map?.worldWidth).toBe(544);
    expect(parsed.project?.collision?.corridor.samples.length).toBeGreaterThan(2);
    expect(parsed.project?.biome?.id).toBe('canyon');
  });

  it('rejects an incomplete package instead of silently skipping files', () => {
    const level = contentRegistry.levels.get('level_01');
    if (!level) throw new Error('missing level_01');
    const project = createEditorProject(level);
    project.routes = undefined;
    expect(validateEditorProject(project)).toContainEqual({
      file: 'routes.json',
      message: 'required Level Package v2 file is missing',
    });
  });

  it('reports unrecognized package documents', () => {
    const parsed = parseProjectPackage([
      { name: 'mystery.json', text: JSON.stringify({ formatVersion: '2.0' }) },
    ]);
    expect(parsed.project).toBeUndefined();
    expect(parsed.errors.some((error) => error.file === 'mystery.json')).toBe(true);
  });
});
