#!/usr/bin/env tsx
import { createHash } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { LevelSchema } from '../src/schemas/levelSchema';
import {
  LEVEL_MUSIC_FORMAT_VERSION,
  appearsToBeMp3,
  createTrackId,
  musicRelativePath,
  normalizeLevelMusicAssignment,
  upsertMusicAsset,
  type MusicAssetRecord,
  type MusicAssetRegistry,
  type MusicAssetSource,
} from '../src/features/levelMusic/levelMusicCore';

const args = parseArgs(process.argv.slice(2));
if (!args.project || !args.level || !args.file) usage();

const projectRoot = await realpath(path.resolve(args.project));
const levelPath = await resolveExistingContained(projectRoot, args.level, 'level');
const levelInput = await readJson(levelPath);
const parsedLevel = LevelSchema.safeParse(levelInput);
if (!parsedLevel.success) {
  fail(
    `Invalid level JSON: ${parsedLevel.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')}`,
  );
}
const level = parsedLevel.data;
const sourcePath = await realpath(path.resolve(args.file));
const sourceStat = await stat(sourcePath).catch(() => null);
if (!sourceStat?.isFile()) fail(`MP3 does not exist: ${sourcePath}`);
if (!sourcePath.toLowerCase().endsWith('.mp3')) fail('Only .mp3 files are accepted.');
if (sourceStat.size <= 0 || sourceStat.size > 100 * 1024 * 1024)
  fail('MP3 must be between 1 byte and 100 MiB.');

const bytes = await readFile(sourcePath);
if (!appearsToBeMp3(bytes)) fail('File does not contain a recognizable MP3 header.');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const id = createTrackId(path.basename(sourcePath), sha256);
const relativePath = musicRelativePath(id);
const musicDirectory = path.join(projectRoot, 'assets/audio/music');
await mkdir(musicDirectory, { recursive: true });
const resolvedMusicDirectory = await realpath(musicDirectory);
assertContained(projectRoot, resolvedMusicDirectory, 'music directory');
const destination = path.join(resolvedMusicDirectory, `${id}.mp3`);
const registryPath = path.join(resolvedMusicDirectory, 'index.json');

await rejectSymlink(registryPath, 'registry');
await rejectSymlink(destination, 'music destination');
if (!(await fileExists(destination))) {
  const temporary = path.join(
    resolvedMusicDirectory,
    `.${id}.${process.pid}.${Date.now()}.tmp`,
  );
  await copyFile(sourcePath, temporary);
  await rename(temporary, destination);
}

const copied = await readFile(destination);
const copiedHash = createHash('sha256').update(copied).digest('hex');
if (copiedHash !== sha256) fail('Copied MP3 failed SHA-256 verification.');

const registry = await readRegistry(registryPath);
const now = new Date().toISOString();
const source: MusicAssetSource = args.source === 'suno' ? 'suno' : 'external';
const baseName = path.basename(sourcePath, path.extname(sourcePath));
const record: MusicAssetRecord = {
  id,
  displayName: String(args.name || baseName).trim().slice(0, 120),
  fileName: path.basename(sourcePath),
  relativePath,
  mimeType: 'audio/mpeg',
  byteLength: copied.byteLength,
  sha256,
  source,
  importedAt: now,
};
await atomicWriteJson(registryPath, upsertMusicAsset(registry, record));

level.levelMusic = normalizeLevelMusicAssignment({
  ...level.levelMusic,
  trackId: id,
  loop: parseBoolean(args.loop, level.levelMusic?.loop ?? true),
  volume: parseNumber(args.volume, 0, 1, level.levelMusic?.volume ?? 0.8),
  startOffsetSeconds: parseNumber(
    args.offset,
    0,
    86_400,
    level.levelMusic?.startOffsetSeconds ?? 0,
  ),
  fadeSeconds: parseNumber(args.fade, 0, 10, level.levelMusic?.fadeSeconds ?? 1),
});
await atomicWriteJson(levelPath, level);

console.log(
  JSON.stringify(
    {
      status: 'IMPORTED',
      projectRoot,
      levelPath,
      assignmentField: 'levelMusic',
      track: record,
    },
    null,
    2,
  ),
);

function parseArgs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith('--')) fail(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else result[key] = 'true';
  }
  return result;
}

function usage(): never {
  console.error(
    'Usage: tsx scripts/import-level-music.ts --project <root> --level <level.json> --file <track.mp3> [--name <title>] [--source suno] [--volume 0.8] [--loop true] [--offset 0] [--fade 1]',
  );
  process.exit(2);
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function assertContained(root: string, candidate: string, label: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    fail(`${label} escapes project root: ${candidate}`);
}

async function resolveExistingContained(
  root: string,
  candidate: string,
  label: string,
): Promise<string> {
  const lexical = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(root, candidate);
  if (!path.isAbsolute(candidate)) assertContained(root, lexical, label);
  const resolved = await realpath(lexical).catch(() => fail(`${label} does not exist`));
  assertContained(root, resolved, label);
  return resolved;
}

async function rejectSymlink(file: string, label: string): Promise<void> {
  const info = await lstat(file).catch(() => null);
  if (info?.isSymbolicLink()) fail(`${label} may not be a symbolic link: ${file}`);
}

async function fileExists(file: string): Promise<boolean> {
  return Boolean(await stat(file).catch(() => null));
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readRegistry(file: string): Promise<MusicAssetRegistry> {
  const value = await readJson(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT')
      return { formatVersion: LEVEL_MUSIC_FORMAT_VERSION, tracks: [] };
    throw error;
  });
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { formatVersion?: unknown }).formatVersion !==
      LEVEL_MUSIC_FORMAT_VERSION ||
    !Array.isArray((value as { tracks?: unknown }).tracks)
  )
    fail(`Unsupported music registry: ${file}`);
  return value as MusicAssetRegistry;
}

async function atomicWriteJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`,
  );
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporary, file);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  fail(`Boolean value must be true or false, received: ${value}`);
}

function parseNumber(
  value: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum)
    fail(`Number must be between ${minimum} and ${maximum}, received: ${value}`);
  return number;
}
