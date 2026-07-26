import { execFile } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { LevelSchema } from '../../schemas/levelSchema';

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
const importer = path.join(repositoryRoot, 'scripts/import-level-music.ts');
const verifier = path.join(repositoryRoot, 'scripts/verify-level-music-assets.ts');

function runScript(script: string, args: string[]) {
  return execFileAsync(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: repositoryRoot,
  });
}

const validLevel = {
  formatVersion: '1.0',
  id: 'level_test',
  displayName: 'Test Level',
  music: 'none',
  durationTarget: 30,
  baseScrollSpeed: 100,
  events: [],
  groundObjects: [],
};

async function fixtureProject(): Promise<{
  root: string;
  level: string;
  mp3: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'skyforge-level-music-'));
  const levels = path.join(root, 'src/content/levels');
  await mkdir(levels, { recursive: true });
  const level = path.join(levels, 'level_test.json');
  const mp3 = path.join(root, 'Coastal Assault.mp3');
  await writeFile(level, `${JSON.stringify(validLevel, null, 2)}\n`);
  await writeFile(mp3, new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]));
  return { root, level, mp3 };
}

describe('level music CLI and verifier', () => {
  it(
    'round-trips the canonical levelMusic field with content identity',
    async () => {
      const fixture = await fixtureProject();
      await runScript(importer, [
        '--project',
        fixture.root,
        '--level',
        fixture.level,
        '--file',
        fixture.mp3,
        '--source',
        'suno',
        '--volume',
        '0.6',
      ]);

      const level = LevelSchema.parse(
        JSON.parse(await readFile(fixture.level, 'utf8')) as unknown,
      );
      expect(level.music).toBe('none');
      expect(level.levelMusic).toMatchObject({
        trackId: expect.stringMatching(/^music-[a-f0-9]{24}$/),
        volume: 0.6,
      });

      const renamed = path.join(fixture.root, 'Renamed.mp3');
      await writeFile(renamed, await readFile(fixture.mp3));
      await runScript(importer, [
        '--project',
        fixture.root,
        '--level',
        fixture.level,
        '--file',
        renamed,
      ]);
      const registry = JSON.parse(
        await readFile(
          path.join(fixture.root, 'assets/audio/music/index.json'),
          'utf8',
        ),
      ) as { tracks: { id: string }[] };
      expect(registry.tracks).toHaveLength(1);
      expect(registry.tracks[0]?.id).toBe(level.levelMusic?.trackId);

      const { stdout } = await runScript(verifier, ['--project', fixture.root]);
      expect(JSON.parse(stdout)).toMatchObject({
        status: 'PASS',
        assignmentField: 'levelMusic',
        trackCount: 1,
        levelFilesChecked: 1,
        validLevelsChecked: 1,
      });
    },
    20_000,
  );

  it(
    'fails closed when no levels exist or a level cannot be parsed',
    async () => {
      const empty = await mkdtemp(path.join(tmpdir(), 'skyforge-no-levels-'));
      await expect(
        runScript(verifier, ['--project', empty]),
      ).rejects.toMatchObject({ code: 1 });

      const invalid = await fixtureProject();
      await writeFile(invalid.level, '{not-json');
      await expect(
        runScript(verifier, ['--project', invalid.root]),
      ).rejects.toMatchObject({ code: 1 });
      await expect(
        runScript(importer, [
          '--project',
          invalid.root,
          '--level',
          invalid.level,
          '--file',
          invalid.mp3,
        ]),
      ).rejects.toMatchObject({ code: 1 });
      await expect(
        stat(path.join(invalid.root, 'assets/audio/music/index.json')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    },
    20_000,
  );

  it('rejects symlinked music assets that escape the project', async () => {
    const fixture = await fixtureProject();
    const musicDirectory = path.join(fixture.root, 'assets/audio/music');
    await mkdir(musicDirectory, { recursive: true });
    const trackId = 'music-aaaaaaaaaaaaaaaaaaaaaaaa';
    const trackPath = `assets/audio/music/${trackId}.mp3`;
    await symlink(fixture.mp3, path.join(fixture.root, trackPath));
    await writeFile(
      path.join(musicDirectory, 'index.json'),
      `${JSON.stringify(
        {
          formatVersion: '1.0',
          tracks: [
            {
              id: trackId,
              displayName: 'Escape',
              fileName: 'Escape.mp3',
              relativePath: trackPath,
              mimeType: 'audio/mpeg',
              byteLength: 6,
              sha256: 'a'.repeat(64),
              source: 'external',
              importedAt: '2026-07-25T00:00:00.000Z',
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    await expect(
      runScript(verifier, ['--project', fixture.root]),
    ).rejects.toMatchObject({ code: 1 });
  });
});
