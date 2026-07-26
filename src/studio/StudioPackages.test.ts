import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  StudioPackageSchema,
  StudioWorkspaceSchema,
} from '../schemas/studioPackageSchema';
import { createBuiltInStudioPackages, createBuiltInWorkspace } from './BuiltInPackages';
import {
  contentFingerprint,
  parseStudioPackage,
  serializeStudioPackage,
} from './PackageCodec';
import { compileStudioWorkspace } from './ContentCompiler';
import { resolveStudioWorkspace, satisfiesVersion } from './DependencyResolver';

describe('Studio package foundation', () => {
  it('creates four valid built-in packages and a valid workspace', () => {
    const packages = createBuiltInStudioPackages();
    expect(packages).toHaveLength(4);
    packages.forEach((pkg) =>
      expect(StudioPackageSchema.safeParse(pkg).success).toBe(true),
    );
    expect(StudioWorkspaceSchema.safeParse(createBuiltInWorkspace()).success).toBe(true);
  });

  it('ships runtime music without bundled composer source', () => {
    const music = createBuiltInStudioPackages().find(
      (pkg) => pkg.format === 'skyforge-music-pack',
    );
    if (!music || music.format !== 'skyforge-music-pack')
      throw new Error('missing music package');
    expect(music.payload.cues.length).toBeGreaterThan(0);
    expect(music.resources.length).toBeGreaterThan(0);
    expect(music.payload.instruments).toEqual([]);
    expect(music.payload.compositions).toEqual([]);
  });

  it('ships a focused asset package with no generation-authoring model', () => {
    const assets = createBuiltInStudioPackages().find(
      (pkg) => pkg.format === 'skyforge-asset-pack',
    );
    if (!assets || assets.format !== 'skyforge-asset-pack')
      throw new Error('missing asset package');
    expect(assets.payload.assets.some((asset) => asset.status === 'approved')).toBe(true);
    expect(Object.keys(assets.payload).sort()).toEqual(['assets', 'atlases', 'tilesets']);
  });

  it('round-trips each package through the portable JSON codec', () => {
    createBuiltInStudioPackages().forEach((pkg) => {
      const parsed = parseStudioPackage(serializeStudioPackage(pkg));
      expect(parsed).toEqual(pkg);
    });
  });

  it('resolves dependencies before the level pack', () => {
    const packages = createBuiltInStudioPackages();
    const result = resolveStudioWorkspace(createBuiltInWorkspace(), packages);
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.ordered.at(-1)?.format).toBe('skyforge-level-pack');
  });

  it('compiles a deterministic content build', () => {
    const packages = createBuiltInStudioPackages();
    const workspace = createBuiltInWorkspace();
    const first = compileStudioWorkspace(workspace, packages);
    const second = compileStudioWorkspace(workspace, packages);
    expect(first.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(first.build?.fingerprint).toBe(second.build?.fingerprint);
    expect(first.build?.content.levelIds).toContain('level_01');
    expect(first.build?.content.musicCueIds).toContain('coastal_assault');
  });

  it('reports a missing required dependency', () => {
    const packages = createBuiltInStudioPackages().filter(
      (pkg) => pkg.format !== 'skyforge-music-pack',
    );
    const result = compileStudioWorkspace(createBuiltInWorkspace(), packages);
    expect(result.build).toBeUndefined();
    expect(result.issues.some((issue) => issue.code === 'missing-package')).toBe(true);
  });

  it('rejects duplicate semantic IDs during portable import', () => {
    const pkg = createBuiltInStudioPackages().find(
      (item) => item.format === 'skyforge-asset-pack',
    );
    expect(pkg).toBeDefined();
    const broken = structuredClone(pkg!);
    if (broken.format !== 'skyforge-asset-pack') throw new Error('unexpected package');
    broken.payload.assets.push(structuredClone(broken.payload.assets[0]!));
    expect(() => parseStudioPackage(JSON.stringify(broken))).toThrow(/duplicate id/);
  });

  it('rejects executable resource URI schemes', () => {
    const pkg = createBuiltInStudioPackages().find(
      (item) => item.format === 'skyforge-music-pack',
    );
    expect(pkg).toBeDefined();
    const broken = structuredClone(pkg!);
    broken.resources.push({
      id: 'unsafe',
      uri: 'javascript:alert(1)',
      mediaType: 'audio/ogg',
    });
    expect(() => parseStudioPackage(JSON.stringify(broken))).toThrow();
  });

  it('rejects imported music whose ID is not derived from its SHA-256', () => {
    const pkg = createBuiltInStudioPackages().find(
      (item) => item.format === 'skyforge-music-pack',
    );
    if (!pkg || pkg.format !== 'skyforge-music-pack')
      throw new Error('missing music package');
    const broken = structuredClone(pkg);
    broken.resources.push({
      id: 'bad-track-resource',
      uri: 'assets/audio/music/bad-track.mp3',
      mediaType: 'audio/mpeg',
      sha256: 'a'.repeat(64),
      bytes: 3,
      embeddedData: 'SUQz',
    });
    broken.payload.tracks.push({
      id: 'bad-track',
      displayName: 'Bad Track',
      fileName: 'bad-track.mp3',
      relativePath: 'assets/audio/music/bad-track.mp3',
      resourceId: 'bad-track-resource',
      mimeType: 'audio/mpeg',
      byteLength: 3,
      sha256: 'a'.repeat(64),
      source: 'external',
      importedAt: '2026-07-25T00:00:00.000Z',
    });
    expect(() => parseStudioPackage(JSON.stringify(broken))).toThrow(
      /SHA-256 content identity/,
    );
  });

  it('supports exact, minimum, and compatible-major version ranges', () => {
    expect(satisfiesVersion('1.2.3', '1.2.3')).toBe(true);
    expect(satisfiesVersion('1.2.3', '>=1.0.0')).toBe(true);
    expect(satisfiesVersion('1.2.3', '^1.1.0')).toBe(true);
    expect(satisfiesVersion('2.0.0', '^1.1.0')).toBe(false);
  });

  it('keeps the checked-in collaborative package examples valid', () => {
    const files = [
      'skyforge-base-levels-1.0.0.sflevelpack',
      'skyforge-standard-tuning-1.0.0.sftuning',
      'skyforge-base-music-1.0.0.sfmusic',
      'skyforge-placeholder-assets-1.0.0.sfassetpack',
    ];
    files.forEach((file) => {
      expect(
        parseStudioPackage(readFileSync(`examples/studio-packages/${file}`, 'utf8')),
      ).toBeDefined();
    });
  });

  it('produces stable fingerprints independent of object key order', () => {
    expect(contentFingerprint({ b: 2, a: 1 })).toBe(contentFingerprint({ a: 1, b: 2 }));
  });
});
