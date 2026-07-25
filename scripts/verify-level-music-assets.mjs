#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const projectRoot = path.resolve(args.project || '.');
const registryPath = path.resolve(projectRoot, 'assets/audio/music/index.json');
const registry = await readJson(registryPath).catch((error) => {
  if (error?.code === 'ENOENT') return { formatVersion: '1.0', tracks: [] };
  throw error;
});
const issues = [];
const ids = new Set();
const paths = new Set();

if (registry.formatVersion !== '1.0' || !Array.isArray(registry.tracks)) {
  issues.push({ code: 'INVALID_REGISTRY', message: 'Registry must have formatVersion 1.0 and a tracks array.' });
} else {
  for (const track of registry.tracks) {
    const id = String(track?.id ?? '');
    const relativePath = String(track?.relativePath ?? '');
    if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(id)) issues.push({ code: 'INVALID_ID', trackId: id });
    if (ids.has(id)) issues.push({ code: 'DUPLICATE_ID', trackId: id });
    ids.add(id);
    if (!isSafeMusicPath(relativePath)) issues.push({ code: 'UNSAFE_PATH', trackId: id, relativePath });
    if (paths.has(relativePath)) issues.push({ code: 'DUPLICATE_PATH', trackId: id, relativePath });
    paths.add(relativePath);
    if (!/^[a-f0-9]{64}$/.test(String(track?.sha256 ?? ''))) issues.push({ code: 'INVALID_SHA256', trackId: id });

    if (isSafeMusicPath(relativePath)) {
      const absolute = path.resolve(projectRoot, relativePath);
      const info = await stat(absolute).catch(() => null);
      if (!info?.isFile()) {
        issues.push({ code: 'MISSING_FILE', trackId: id, relativePath });
      } else {
        const bytes = await readFile(absolute);
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (hash !== track.sha256) issues.push({ code: 'HASH_MISMATCH', trackId: id, expected: track.sha256, actual: hash });
        if (bytes.byteLength !== track.byteLength) issues.push({ code: 'BYTE_LENGTH_MISMATCH', trackId: id, expected: track.byteLength, actual: bytes.byteLength });
      }
    }
  }
}

const levelFiles = args.level
  ? [resolveContained(projectRoot, args.level)]
  : await findLevelJsonFiles(projectRoot);
for (const file of levelFiles) {
  const level = await readJson(file).catch(() => null);
  const trackId = level?.music?.trackId;
  if (typeof trackId === 'string' && trackId && !ids.has(trackId)) {
    issues.push({ code: 'MISSING_TRACK_REFERENCE', level: path.relative(projectRoot, file), trackId });
  }
}

const report = {
  status: issues.length === 0 ? 'PASS' : 'FAIL',
  projectRoot,
  registry: path.relative(projectRoot, registryPath),
  trackCount: Array.isArray(registry.tracks) ? registry.tracks.length : 0,
  levelFilesChecked: levelFiles.length,
  issues,
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = issues.length === 0 ? 0 : 1;

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith('--')) { result[key] = next; index += 1; }
    else result[key] = 'true';
  }
  return result;
}
function isSafeMusicPath(value) {
  if (!value || value.includes('\\') || value.startsWith('/') || value.includes('\0')) return false;
  const segments = value.split('/');
  return value.startsWith('assets/audio/music/')
    && value.toLowerCase().endsWith('.mp3')
    && !segments.some((segment) => !segment || segment === '.' || segment === '..');
}
function resolveContained(root, candidate) {
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path escapes project root: ${candidate}`);
  return resolved;
}
async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function findLevelJsonFiles(root) {
  const candidates = [path.join(root, 'src/content/levels'), path.join(root, 'levels')];
  const found = [];
  for (const candidate of candidates) await walk(candidate, found);
  return found.sort();
}
async function walk(directory, found) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, found);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) found.push(absolute);
  }
}
