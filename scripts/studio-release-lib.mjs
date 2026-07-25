import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';

export const packageExtensions = [
  '.sflevelpack',
  '.sftuning',
  '.sfmusic',
  '.sfassetpack',
];
export const typeOf = (pkg) =>
  ({
    'skyforge-level-pack': 'level',
    'skyforge-tuning-pack': 'tuning',
    'skyforge-music-pack': 'music',
    'skyforge-asset-pack': 'asset',
  })[pkg.format];

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}
export function fingerprint(value) {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function migratePackage(pkg) {
  if ((pkg.schemaVersion ?? 1) === 1) {
    pkg.schemaVersion = 2;
    pkg.manifest.contentRevision ??= 1;
    pkg.reviewComments ??= [];
  }
  if (pkg.schemaVersion !== 2)
    throw new Error(`Unsupported package schema ${pkg.schemaVersion}`);
  return pkg;
}
export function migrateWorkspace(workspace) {
  if ((workspace.schemaVersion ?? 1) === 1) {
    workspace.schemaVersion = 2;
    workspace.reviewComments ??= [];
  }
  if (workspace.schemaVersion !== 2)
    throw new Error(`Unsupported workspace schema ${workspace.schemaVersion}`);
  return workspace;
}

export async function loadWorkspace(path) {
  return migrateWorkspace(JSON.parse(await readFile(path, 'utf8')));
}
export async function loadPackages(directory) {
  const names = (await readdir(directory))
    .filter((name) => packageExtensions.some((ext) => name.endsWith(ext)))
    .sort();
  return Promise.all(
    names.map(async (name) =>
      migratePackage(JSON.parse(await readFile(join(directory, name), 'utf8'))),
    ),
  );
}
export function selectedPackages(workspace, packages) {
  return Object.entries(workspace.packages).map(([type, ref]) => {
    const pkg = packages.find(
      (candidate) => typeOf(candidate) === type && candidate.manifest.id === ref.id,
    );
    if (!pkg) throw new Error(`Missing package ${type}:${ref.id}`);
    if (pkg.manifest.version !== ref.version)
      throw new Error(`Version mismatch for ${type}:${ref.id}`);
    return pkg;
  });
}
export function createLock(workspace, packages, generatedAt = new Date().toISOString()) {
  const selected = selectedPackages(workspace, packages);
  const base = {
    format: 'skyforge-lock',
    schemaVersion: 1,
    workspace: {
      id: workspace.id,
      version: workspace.version,
      fingerprint: fingerprint(workspace),
    },
    packages: selected.map((pkg) => ({
      type: typeOf(pkg),
      id: pkg.manifest.id,
      version: pkg.manifest.version,
      contentRevision: pkg.manifest.contentRevision ?? 1,
      fingerprint: fingerprint(pkg),
      resources: (pkg.resources ?? [])
        .map((resource) => ({
          id: resource.id,
          ...(resource.sha256 ? { sha256: resource.sha256 } : {}),
          ...(resource.bytes !== undefined ? { bytes: resource.bytes } : {}),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    })),
    generatedAt,
  };
  return { ...base, fingerprint: fingerprint(base) };
}
export function validateLock(lock, workspace, packages) {
  const expected = createLock(workspace, packages, lock.generatedAt);
  if (lock.workspace.fingerprint !== expected.workspace.fingerprint)
    throw new Error('Workspace differs from dependency lock');
  for (const entry of lock.packages) {
    const match = expected.packages.find(
      (candidate) => candidate.type === entry.type && candidate.id === entry.id,
    );
    if (!match || stableStringify(match) !== stableStringify(entry))
      throw new Error(`Package differs from lock: ${entry.type}:${entry.id}`);
  }
}

function liveResourceIds(pkg) {
  if (pkg.format === 'skyforge-asset-pack') {
    const ids = new Set();
    pkg.payload.assets.forEach((item) => item.resourceId && ids.add(item.resourceId));
    pkg.payload.tilesets.forEach((item) => item.resourceId && ids.add(item.resourceId));
    pkg.payload.atlases.forEach((item) => ids.add(item.resourceId));
    return ids;
  }
  if (pkg.format === 'skyforge-music-pack') {
    const ids = new Set();
    const byUri = new Map(pkg.resources.map((resource) => [resource.uri, resource.id]));
    pkg.payload.cues.forEach((cue) =>
      [cue.fullMix, ...cue.stems.map((stem) => stem.asset)]
        .filter(Boolean)
        .forEach((uri) => byUri.has(uri) && ids.add(byUri.get(uri))),
    );
    pkg.payload.instruments.forEach(
      (item) => item.kind === 'sample' && ids.add(item.resourceId),
    );
    return ids;
  }
  return new Set(pkg.resources.map((resource) => resource.id));
}

function safeName(resource) {
  return (
    resource.filename ||
    basename(resource.uri) ||
    `${resource.id}${extname(resource.uri) || '.bin'}`
  ).replace(/[^A-Za-z0-9._-]+/g, '-');
}

export async function compileRelease({ workspace, packages, lock, output, publicDir }) {
  validateLock(lock, workspace, packages);
  const selected = selectedPackages(workspace, packages);
  for (const pkg of selected) {
    const blocking = (pkg.reviewComments ?? []).filter(
      (comment) => comment.status === 'open' && comment.severity === 'blocking',
    );
    if (blocking.length)
      throw new Error(
        `${typeOf(pkg)}:${pkg.manifest.id} has unresolved blocking review comments`,
      );
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(join(output, 'resources'), { recursive: true });
  await mkdir(join(output, 'content', 'packages'), { recursive: true });
  const artifacts = [];
  const removed = [];
  for (const pkg of selected) {
    const live = liveResourceIds(pkg);
    const compiledResources = [];
    for (const resource of pkg.resources ?? []) {
      if (!live.has(resource.id)) {
        removed.push({
          packageKey: `${typeOf(pkg)}:${pkg.manifest.id}`,
          resourceId: resource.id,
          reason: 'unreferenced',
        });
        continue;
      }
      const bytes = resource.embeddedData
        ? Buffer.from(resource.embeddedData, 'base64')
        : await readFile(resolve(publicDir, resource.uri.replace(/^\//, '')));
      const hash = sha256(bytes);
      if (resource.sha256 && resource.sha256 !== hash)
        throw new Error(`${resource.id} SHA-256 mismatch`);
      if (resource.bytes !== undefined && resource.bytes !== bytes.length)
        throw new Error(`${resource.id} byte count mismatch`);
      const target = `resources/${typeOf(pkg)}/${hash.slice(0, 16)}-${safeName(resource)}`;
      await mkdir(dirname(join(output, target)), { recursive: true });
      await writeFile(join(output, target), bytes);
      artifacts.push({
        packageKey: `${typeOf(pkg)}:${pkg.manifest.id}`,
        resourceId: resource.id,
        sourceUri: resource.uri,
        targetPath: target,
        mediaType: resource.mediaType,
        bytes: bytes.length,
        sha256: hash,
      });
      const { embeddedData: _embeddedData, ...metadata } = resource;
      compiledResources.push({
        ...metadata,
        uri: target,
        sha256: hash,
        bytes: bytes.length,
      });
    }
    const compiledPackage = { ...pkg, resources: compiledResources };
    const filename = `${typeOf(pkg)}-${pkg.manifest.id}-${pkg.manifest.version}.json`;
    await writeFile(join(output, 'content', 'packages', filename), json(compiledPackage));
  }
  await writeFile(join(output, 'content', 'workspace.json'), json(workspace));
  await writeFile(join(output, 'content', 'skyforge.lock'), json(lock));
  const manifestBase = {
    workspaceId: workspace.id,
    workspaceVersion: workspace.version,
    lockFingerprint: lock.fingerprint,
    packages: selected.map(
      (pkg) => `${typeOf(pkg)}:${pkg.manifest.id}@${pkg.manifest.version}`,
    ),
    activeLevelId: workspace.activeLevelId,
    resources: artifacts.sort((a, b) => a.targetPath.localeCompare(b.targetPath)),
    removedResources: removed.sort((a, b) => a.resourceId.localeCompare(b.resourceId)),
  };
  const manifest = {
    format: 'skyforge-production-build',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ...manifestBase,
    contentFingerprint: fingerprint(manifestBase),
  };
  await writeFile(join(output, 'release-manifest.json'), json(manifest));
  return manifest;
}
