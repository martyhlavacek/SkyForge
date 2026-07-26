import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  StudioPackageSchema,
  StudioWorkspaceSchema,
  type LevelStudioPackage,
  type MusicStudioPackage,
  type StudioPackage,
} from '../../schemas/studioPackageSchema';
import { contentRegistry } from '../../game/systems/ContentRegistry';
import { installProductionContent } from '../../game/systems/ProductionContent';
import { importedTrackCue } from './ImportedTrackCue';

interface ReleaseTools {
  createLock(
    workspace: unknown,
    packages: unknown[],
    generatedAt?: string,
  ): unknown;
  compileRelease(options: {
    workspace: unknown;
    packages: unknown[];
    lock: unknown;
    output: string;
    publicDir: string;
  }): Promise<{ runtimeMusicCueIds: string[]; resources: { resourceId: string }[] }>;
}

const releaseTools = (await import(
  '../../../scripts/studio-release-lib.mjs'
)) as ReleaseTools;
const temporaryDirectories: string[] = [];

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

async function exampleInputs(): Promise<{
  workspace: ReturnType<typeof StudioWorkspaceSchema.parse>;
  packages: StudioPackage[];
}> {
  const root = path.join(process.cwd(), 'examples/studio-packages');
  const workspace = StudioWorkspaceSchema.parse(
    await readJson(path.join(root, 'skyforge-main-workspace.sfworkspace')),
  );
  const names = (await readdir(root))
    .filter((name) =>
      ['.sflevelpack', '.sftuning', '.sfmusic', '.sfassetpack'].some((extension) =>
        name.endsWith(extension),
      ),
    )
    .sort();
  const packages = await Promise.all(
    names.map(async (name) =>
      StudioPackageSchema.parse(await readJson(path.join(root, name))),
    ),
  );
  return { workspace, packages };
}

function packageOf<T extends StudioPackage>(
  packages: StudioPackage[],
  format: T['format'],
): T {
  const pkg = packages.find((candidate) => candidate.format === format);
  if (!pkg) throw new Error(`Missing ${format}`);
  return pkg as T;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('production imported-MP3 reachability', () => {
  it('compiles one assigned MP3 into a runtime cue and installs it before play', async () => {
    const { workspace, packages } = await exampleInputs();
    const level = packageOf<LevelStudioPackage>(packages, 'skyforge-level-pack');
    const music = packageOf<MusicStudioPackage>(packages, 'skyforge-music-pack');
    const bytes = new Uint8Array(
      await readFile(path.join(process.cwd(), 'e2e/fixtures/level-music-test.mp3')),
    );
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const trackId = `music-${sha256.slice(0, 24)}`;
    const unusedId = 'music-bbbbbbbbbbbbbbbbbbbbbbbb';

    music.payload.tracks.push(
      {
        id: trackId,
        displayName: 'Compiled Level Track',
        fileName: 'compiled-level-track.mp3',
        relativePath: `assets/audio/music/${trackId}.mp3`,
        resourceId: trackId,
        mimeType: 'audio/mpeg',
        byteLength: bytes.byteLength,
        sha256,
        durationSeconds: 1.2,
        source: 'external',
        importedAt: '2026-07-25T00:00:00.000Z',
      },
      {
        id: unusedId,
        displayName: 'Unused Track',
        fileName: 'unused.mp3',
        relativePath: `assets/audio/music/${unusedId}.mp3`,
        resourceId: unusedId,
        mimeType: 'audio/mpeg',
        byteLength: 3,
        sha256: 'b'.repeat(64),
        source: 'external',
        importedAt: '2026-07-25T00:00:00.000Z',
      },
    );
    music.resources.push(
      {
        id: trackId,
        uri: `assets/audio/music/${trackId}.mp3`,
        filename: 'compiled-level-track.mp3',
        mediaType: 'audio/mpeg',
        embeddedData: Buffer.from(bytes).toString('base64'),
        bytes: bytes.byteLength,
        sha256,
      },
      {
        id: unusedId,
        uri: `assets/audio/music/${unusedId}.mp3`,
        filename: 'unused.mp3',
        mediaType: 'audio/mpeg',
        embeddedData: 'SUQz',
        bytes: 3,
        sha256: 'b'.repeat(64),
      },
    );
    level.payload.levels[0]!.levelMusic = {
      trackId,
      loop: true,
      volume: 0.65,
      startOffsetSeconds: 0.25,
      fadeSeconds: 0.5,
    };

    const output = await mkdtemp(path.join(tmpdir(), 'skyforge-production-music-'));
    temporaryDirectories.push(output);
    const lock = releaseTools.createLock(
      workspace,
      packages,
      '2026-07-25T00:00:00.000Z',
    );
    const manifest = await releaseTools.compileRelease({
      workspace,
      packages,
      lock,
      output,
      publicDir: path.join(process.cwd(), 'public'),
    });

    expect(manifest.runtimeMusicCueIds).toContain(trackId);
    expect(manifest.resources.map((resource) => resource.resourceId)).toContain(trackId);
    expect(manifest.resources.map((resource) => resource.resourceId)).not.toContain(
      unusedId,
    );

    const packageDirectory = path.join(output, 'content/packages');
    const compiledPackages = await Promise.all(
      (await readdir(packageDirectory))
        .sort()
        .map((name) => readJson(path.join(packageDirectory, name))),
    );
    const compiledMusic = packageOf<MusicStudioPackage>(
      compiledPackages.map((value) => StudioPackageSchema.parse(value)),
      'skyforge-music-pack',
    );
    const compiledTrack = compiledMusic.payload.tracks.find(
      (track) => track.id === trackId,
    );
    const compiledResource = compiledMusic.resources.find(
      (resource) => resource.id === trackId,
    );
    expect(compiledMusic.payload.cues.some((cue) => cue.id === trackId)).toBe(false);
    expect(compiledResource?.uri).toMatch(
      /^resources\/music\/[a-f0-9]{16}-compiled-level-track\.mp3$/,
    );
    expect(compiledMusic.payload.tracks.map((track) => track.id)).toEqual([trackId]);

    const installed = installProductionContent(workspace, compiledPackages);
    expect(installed).toMatchObject({
      loaded: true,
      activeLevelId: 'level_01',
      packageCount: 4,
    });
    expect(contentRegistry.levels.get('level_01')?.levelMusic?.trackId).toBe(trackId);
    expect(contentRegistry.music.get(trackId)).toEqual(
      importedTrackCue(compiledTrack!, compiledResource!.uri),
    );
    expect(contentRegistry.errors).toEqual([]);
  });
});
