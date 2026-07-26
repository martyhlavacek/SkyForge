#!/usr/bin/env tsx
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { LevelSchema } from '../src/schemas/levelSchema';
import {
  LEVEL_MUSIC_FORMAT_VERSION,
  appearsToBeMp3,
  createTrackId,
  isSafeMusicRelativePath,
  musicRelativePath,
  validateLevelMusicModel,
  type MusicAssetRegistry,
} from '../src/features/levelMusic/levelMusicCore';

interface VerificationIssue {
  code: string;
  message: string;
  level?: string;
  trackId?: string;
  relativePath?: string;
}

const args = parseArgs(process.argv.slice(2));
const projectRoot = await realpath(path.resolve(args.project || '.'));
const registryPath = path.join(projectRoot, 'assets/audio/music/index.json');
const registry = await readRegistry(projectRoot, registryPath);
const issues: VerificationIssue[] = [];
const ids = new Set<string>();
const paths = new Set<string>();

for (const track of registry.tracks) {
  if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(track.id))
    issues.push({ code: 'INVALID_ID', message: 'Track ID is unsafe.', trackId: track.id });
  if (ids.has(track.id))
    issues.push({ code: 'DUPLICATE_ID', message: 'Track ID is duplicated.', trackId: track.id });
  ids.add(track.id);
  if (!isSafeMusicRelativePath(track.relativePath))
    issues.push({
      code: 'UNSAFE_PATH',
      message: 'Track path is unsafe.',
      trackId: track.id,
      relativePath: track.relativePath,
    });
  if (paths.has(track.relativePath))
    issues.push({
      code: 'DUPLICATE_PATH',
      message: 'Track path is duplicated.',
      trackId: track.id,
      relativePath: track.relativePath,
    });
  paths.add(track.relativePath);
  if (!/^[a-f0-9]{64}$/.test(track.sha256))
    issues.push({
      code: 'INVALID_SHA256',
      message: 'Track SHA-256 is invalid.',
      trackId: track.id,
    });
  if (
    /^[a-f0-9]{64}$/.test(track.sha256) &&
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(track.id) &&
    track.id !== createTrackId(track.fileName, track.sha256)
  )
    issues.push({
      code: 'IDENTITY_MISMATCH',
      message: 'Track ID is not derived from its SHA-256 content identity.',
      trackId: track.id,
    });
  if (
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(track.id) &&
    track.relativePath !== musicRelativePath(track.id)
  )
    issues.push({
      code: 'NONCANONICAL_PATH',
      message: 'Track path does not match its canonical content-addressed path.',
      trackId: track.id,
      relativePath: track.relativePath,
    });

  if (!isSafeMusicRelativePath(track.relativePath)) continue;
  const lexical = path.resolve(projectRoot, track.relativePath);
  assertContained(projectRoot, lexical, 'music asset');
  const info = await lstat(lexical).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()) {
    issues.push({
      code: info?.isSymbolicLink() ? 'SYMLINK_FILE' : 'MISSING_FILE',
      message: info?.isSymbolicLink()
        ? 'Music assets may not be symbolic links.'
        : 'Music asset is missing.',
      trackId: track.id,
      relativePath: track.relativePath,
    });
    continue;
  }
  const resolved = await realpath(lexical);
  assertContained(projectRoot, resolved, 'music asset');
  const bytes = await readFile(resolved);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== track.sha256)
    issues.push({
      code: 'HASH_MISMATCH',
      message: 'Track SHA-256 does not match.',
      trackId: track.id,
    });
  if (bytes.byteLength !== track.byteLength)
    issues.push({
      code: 'BYTE_LENGTH_MISMATCH',
      message: 'Track byte length does not match.',
      trackId: track.id,
    });
  if (!appearsToBeMp3(bytes))
    issues.push({
      code: 'INVALID_MP3_HEADER',
      message: 'Track does not have a recognizable MP3 header.',
      trackId: track.id,
    });
}

const levelFiles = args.level
  ? [await resolveExistingContained(projectRoot, args.level, 'level')]
  : await findLevelJsonFiles(projectRoot);
if (levelFiles.length === 0)
  issues.push({
    code: 'NO_LEVEL_FILES',
    message: 'No level JSON files were found; verification fails closed.',
  });

const parsedLevels: {
  id: string;
  levelMusic?: Record<string, unknown>;
}[] = [];
for (const file of levelFiles) {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    issues.push({
      code: 'INVALID_LEVEL_JSON',
      message: error instanceof Error ? error.message : 'Level JSON could not be parsed.',
      level: path.relative(projectRoot, file),
    });
    continue;
  }
  const parsed = LevelSchema.safeParse(value);
  if (!parsed.success) {
    issues.push({
      code: 'INVALID_LEVEL_SCHEMA',
      message: parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; '),
      level: path.relative(projectRoot, file),
    });
    continue;
  }
  parsedLevels.push({
    id: parsed.data.id,
    levelMusic: parsed.data.levelMusic as unknown as
      | Record<string, unknown>
      | undefined,
  });
}

validateLevelMusicModel(registry, parsedLevels).forEach((issue) =>
  issues.push({
    code: issue.code,
    message: issue.message,
    level: issue.levelId,
    trackId: issue.trackId,
  }),
);

const report = {
  status: issues.length === 0 ? 'PASS' : 'FAIL',
  projectRoot,
  assignmentField: 'levelMusic',
  registry: path.relative(projectRoot, registryPath),
  trackCount: registry.tracks.length,
  levelFilesChecked: levelFiles.length,
  validLevelsChecked: parsedLevels.length,
  issues,
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = issues.length === 0 ? 0 : 1;

function parseArgs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith('--')) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else result[key] = 'true';
  }
  return result;
}

function assertContained(root: string, candidate: string, label: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error(`${label} escapes project root: ${candidate}`);
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
  const resolved = await realpath(lexical);
  assertContained(root, resolved, label);
  return resolved;
}

async function readRegistry(root: string, file: string): Promise<MusicAssetRegistry> {
  const info = await lstat(file).catch(() => null);
  if (!info)
    return { formatVersion: LEVEL_MUSIC_FORMAT_VERSION, tracks: [] };
  if (info.isSymbolicLink()) throw new Error('Music registry may not be a symbolic link.');
  const resolved = await realpath(file);
  assertContained(root, resolved, 'music registry');
  const value = JSON.parse(await readFile(resolved, 'utf8')) as unknown;
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { formatVersion?: unknown }).formatVersion !==
      LEVEL_MUSIC_FORMAT_VERSION ||
    !Array.isArray((value as { tracks?: unknown }).tracks)
  )
    throw new Error('Registry must have formatVersion 1.0 and a tracks array.');
  return value as MusicAssetRegistry;
}

async function findLevelJsonFiles(root: string): Promise<string[]> {
  const candidates = [
    path.join(root, 'src/content/levels'),
    path.join(root, 'levels'),
  ];
  const found: string[] = [];
  for (const candidate of candidates) await walk(root, candidate, found);
  return found.sort();
}

async function walk(root: string, directory: string, found: string[]): Promise<void> {
  const info = await lstat(directory).catch(() => null);
  if (!info || info.isSymbolicLink() || !info.isDirectory()) return;
  const resolvedDirectory = await realpath(directory);
  assertContained(root, resolvedDirectory, 'level directory');
  const entries = await readdir(resolvedDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(resolvedDirectory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await walk(root, absolute, found);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      found.push(await resolveExistingContained(root, absolute, 'level'));
  }
}
