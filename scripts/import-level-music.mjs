#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
if (!args.project || !args.level || !args.file) usage();

const projectRoot = path.resolve(args.project);
const levelPath = resolveContained(projectRoot, args.level, 'level');
const sourcePath = path.resolve(args.file);
const sourceStat = await stat(sourcePath).catch(() => null);
if (!sourceStat?.isFile()) fail(`MP3 does not exist: ${sourcePath}`);
if (!sourcePath.toLowerCase().endsWith('.mp3')) fail('Only .mp3 files are accepted.');
if (sourceStat.size <= 0 || sourceStat.size > 100 * 1024 * 1024) {
  fail('MP3 must be between 1 byte and 100 MiB.');
}

const bytes = await readFile(sourcePath);
if (!appearsToBeMp3(bytes)) fail('File does not contain a recognizable MP3 header.');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const baseName = path.basename(sourcePath, path.extname(sourcePath));
const id = `${slugify(baseName)}-${sha256.slice(0, 12)}`;
const relativePath = `assets/audio/music/${id}.mp3`;
const destination = resolveContained(projectRoot, relativePath, 'music destination');
const registryPath = resolveContained(projectRoot, 'assets/audio/music/index.json', 'registry');

await mkdir(path.dirname(destination), { recursive: true });
if (!(await fileExists(destination))) {
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  await copyFile(sourcePath, temporary);
  await rename(temporary, destination);
}

const copied = await readFile(destination);
const copiedHash = createHash('sha256').update(copied).digest('hex');
if (copiedHash !== sha256) fail('Copied MP3 failed SHA-256 verification.');

const registry = await readJson(registryPath, { formatVersion: '1.0', tracks: [] });
if (registry.formatVersion !== '1.0' || !Array.isArray(registry.tracks)) {
  fail(`Unsupported music registry: ${registryPath}`);
}
const now = new Date().toISOString();
const record = {
  id,
  displayName: String(args.name || baseName).trim().slice(0, 120),
  fileName: path.basename(sourcePath),
  relativePath,
  mimeType: 'audio/mpeg',
  byteLength: copied.byteLength,
  sha256,
  source: args.source === 'suno' ? 'suno' : 'external',
  importedAt: now,
};
registry.tracks = registry.tracks
  .filter((track) => track?.id !== id && track?.sha256 !== sha256)
  .concat(record)
  .sort((a, b) => String(a.id).localeCompare(String(b.id)));
await atomicWriteJson(registryPath, registry);

const level = await readJson(levelPath, null);
if (!level || typeof level !== 'object' || Array.isArray(level)) fail(`Invalid level JSON: ${levelPath}`);
level.music = {
  ...(level.music && typeof level.music === 'object' && !Array.isArray(level.music) ? level.music : {}),
  trackId: id,
  loop: parseBoolean(args.loop, true),
  volume: clampNumber(args.volume, 0, 1, 0.8),
  startOffsetSeconds: clampNumber(args.offset, 0, 86_400, 0),
  fadeSeconds: clampNumber(args.fade, 0, 10, 1),
};
await atomicWriteJson(levelPath, level);

console.log(JSON.stringify({ status: 'IMPORTED', projectRoot, levelPath, track: record }, null, 2));

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) fail(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = 'true';
    }
  }
  return result;
}
function usage() {
  console.error('Usage: node scripts/import-level-music.mjs --project <root> --level <level.json> --file <track.mp3> [--name <title>] [--source suno] [--volume 0.8] [--loop true] [--offset 0] [--fade 1]');
  process.exit(2);
}
function fail(message) { console.error(`ERROR: ${message}`); process.exit(1); }
function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'music-track';
}
function appearsToBeMp3(buffer) {
  return (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
    || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
}
function resolveContained(root, candidate, label) {
  const resolved = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail(`${label} escapes project root: ${candidate}`);
  return resolved;
}
async function fileExists(file) { return Boolean(await stat(file).catch(() => null)); }
async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT' && fallback !== null) return structuredClone(fallback); throw error; }
}
async function atomicWriteJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, file);
}
function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  fail(`Boolean value must be true or false, received: ${value}`);
}
function clampNumber(value, min, max, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) fail(`Expected a finite number, received: ${value}`);
  return Math.min(max, Math.max(min, number));
}
