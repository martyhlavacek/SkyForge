import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import {
  StudioPackageSchema,
  StudioWorkspaceSchema,
  type LevelStudioPackage,
  type MusicStudioPackage,
  type StudioPackage,
} from '../src/schemas/studioPackageSchema';
import { compileRelease, createLock } from '../scripts/studio-release-lib.mjs';

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

function packageOf<T extends StudioPackage>(
  packages: StudioPackage[],
  format: T['format'],
): T {
  const pkg = packages.find((candidate) => candidate.format === format);
  if (!pkg) throw new Error(`Missing ${format}`);
  return pkg as T;
}

async function filesBelow(root: string, relative = ''): Promise<string[]> {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const child = path.join(relative, entry.name);
      return entry.isDirectory() ? filesBelow(root, child) : [child];
    }),
  );
  return files.flat().sort();
}

async function routeRelease(page: Page, output: string): Promise<void> {
  for (const relative of await filesBelow(output)) {
    const url = new URL(relative.split(path.sep).join('/'), 'http://127.0.0.1:4173/');
    await page.route(url.toString(), (route: Route) =>
      route.fulfill({ path: path.join(output, relative) }),
    );
  }
}

test('compiled non-Studio release registers and plays its assigned MP3', async ({
  page,
}) => {
  const input = path.join(process.cwd(), 'examples/studio-packages');
  const workspace = StudioWorkspaceSchema.parse(
    await readJson(path.join(input, 'skyforge-main-workspace.sfworkspace')),
  );
  const packages = await Promise.all(
    (await readdir(input))
      .filter((name) =>
        ['.sflevelpack', '.sftuning', '.sfmusic', '.sfassetpack'].some(
          (extension) => name.endsWith(extension),
        ),
      )
      .sort()
      .map(async (name) =>
        StudioPackageSchema.parse(await readJson(path.join(input, name))),
      ),
  );
  const level = packageOf<LevelStudioPackage>(packages, 'skyforge-level-pack');
  const music = packageOf<MusicStudioPackage>(packages, 'skyforge-music-pack');
  const bytes = new Uint8Array(
    await readFile(path.join(process.cwd(), 'e2e/fixtures/level-music-test.mp3')),
  );
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const trackId = `music-${sha256.slice(0, 24)}`;
  music.payload.tracks.push({
    id: trackId,
    displayName: 'Production Browser Track',
    fileName: 'production-browser-track.mp3',
    relativePath: `assets/audio/music/${trackId}.mp3`,
    resourceId: trackId,
    mimeType: 'audio/mpeg',
    byteLength: bytes.byteLength,
    sha256,
    source: 'external',
    importedAt: '2026-07-25T00:00:00.000Z',
  });
  music.resources.push({
    id: trackId,
    uri: `assets/audio/music/${trackId}.mp3`,
    filename: 'production-browser-track.mp3',
    mediaType: 'audio/mpeg',
    embeddedData: Buffer.from(bytes).toString('base64'),
    bytes: bytes.byteLength,
    sha256,
  });
  level.payload.levels[0]!.levelMusic = {
    trackId,
    loop: true,
    volume: 0.7,
    startOffsetSeconds: 0.2,
    fadeSeconds: 0.1,
  };

  const output = await mkdtemp(path.join(tmpdir(), 'skyforge-browser-release-'));
  try {
    const lock = createLock(workspace, packages, '2026-07-25T00:00:00.000Z');
    const manifest = await compileRelease({
      workspace,
      packages,
      lock,
      output,
      publicDir: path.join(process.cwd(), 'public'),
    });
    expect(manifest.runtimeMusicCueIds).toContain(trackId);
    await routeRelease(page, output);

    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/index.html?preview=1&level=level_01');
    await page.waitForFunction(
      (cueId) =>
        window.__skyforge?.activeScenes().includes('GameScene') &&
        (
          window.__skyforge.musicState() as
            | { pendingCueId?: string | null }
            | undefined
        )?.pendingCueId === cueId,
      trackId,
    );
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await canvas.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__skyforge?.musicState() as unknown),
      )
      .toMatchObject({
        cueId: trackId,
        pendingCueId: null,
        contextState: 'running',
      });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
