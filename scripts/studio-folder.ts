#!/usr/bin/env node
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
  relative,
  resolve,
  sep,
} from 'node:path';
import { pathToFileURL } from 'node:url';
import type { StudioPackage } from '../src/schemas/studioPackageSchema';
import { parseStudioPackage } from '../src/studio/PackageCodec';

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export function safeOutputPath(rootDirectory: string, relativePath: string): string {
  if (
    !relativePath ||
    relativePath.includes('\0') ||
    relativePath.includes('\\') ||
    /^[A-Za-z]:/.test(relativePath)
  )
    throw new Error(`Unsafe package path: ${JSON.stringify(relativePath)}`);
  const root = resolve(rootDirectory);
  const output = resolve(root, relativePath);
  if (output !== root && !output.startsWith(`${root}${sep}`))
    throw new Error(`Unsafe package path: ${relativePath}`);
  return output;
}

export function sanitizeResourceFilename(value: string): string {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.split(/[\\/]/).some((segment) => segment === '.' || segment === '..')
  )
    throw new Error('Resource filename is empty or unsafe');
  const sanitized = trimmed
    .replace(/[\\/]/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 180);
  if (!sanitized || sanitized === '.' || sanitized === '..')
    throw new Error(`Unsafe resource filename: ${value}`);
  return sanitized;
}

function orderIndex(pkg: StudioPackage): Record<string, string[]> {
  switch (pkg.format) {
    case 'skyforge-level-pack': {
      const p = pkg.payload;
      return {
        levels: p.levels.map((value) => value.id),
        'level-packages': p.levelPackages.map((value) => value.id),
        maps: p.maps.map((value) => value.id),
        collisions: p.collisions.map((value) => value.id),
        routes: p.routes.map((value) => value.id),
        objects: p.objects.map((value) => value.id),
        biomes: p.biomes.map((value) => value.id),
      };
    }
    case 'skyforge-tuning-pack': {
      const p = pkg.payload;
      return {
        enemies: p.enemies.map((value) => value.id),
        weapons: p.weapons.map((value) => value.id),
        'projectile-patterns': p.projectilePatterns.map((value) => value.id),
        'movement-patterns': p.movementPatterns.map((value) => value.id),
        formations: p.formations.map((value) => value.id),
        encounters: p.encounters.map((value) => value.id),
        bosses: p.bosses.map((value) => value.id),
        pickups: p.pickups.map((value) => value.id),
        equipment: p.equipment.map((value) => value.id),
      };
    }
    case 'skyforge-music-pack': {
      const p = pkg.payload;
      return {
        cues: p.cues.map((value) => value.id),
        instruments: p.instruments.map((value) => value.id),
        compositions: p.compositions.map((value) => value.id),
      };
    }
    case 'skyforge-asset-pack': {
      const p = pkg.payload;
      return {
        assets: p.assets.map((value) => value.id),
        tilesets: p.tilesets.map((value) => value.id),
        atlases: p.atlases.map((value) => value.id),
      };
    }
  }
}

type CategoryEntry = readonly [path: string, value: unknown];

function categories(pkg: StudioPackage): CategoryEntry[] {
  switch (pkg.format) {
    case 'skyforge-level-pack': {
      const p = pkg.payload;
      return [
        ...(p.campaign ? ([['payload/campaign.json', p.campaign]] as CategoryEntry[]) : []),
        ...p.levels.map((value) => [`payload/levels/${value.id}.json`, value] as const),
        ...p.levelPackages.map(
          (value) => [`payload/level-packages/${value.id}.json`, value] as const,
        ),
        ...p.maps.map((value) => [`payload/maps/${value.id}.json`, value] as const),
        ...p.collisions.map(
          (value) => [`payload/collisions/${value.id}.json`, value] as const,
        ),
        ...p.routes.map((value) => [`payload/routes/${value.id}.json`, value] as const),
        ...p.objects.map((value) => [`payload/objects/${value.id}.json`, value] as const),
        ...p.biomes.map((value) => [`payload/biomes/${value.id}.json`, value] as const),
      ];
    }
    case 'skyforge-tuning-pack': {
      const p = pkg.payload;
      return [
        ['payload/profile.json', { profileId: p.profileId }],
        ['payload/difficulty.json', p.difficulty],
        ...p.enemies.map((value) => [`payload/enemies/${value.id}.json`, value] as const),
        ...p.weapons.map((value) => [`payload/weapons/${value.id}.json`, value] as const),
        ...p.projectilePatterns.map(
          (value) => [`payload/projectile-patterns/${value.id}.json`, value] as const,
        ),
        ...p.movementPatterns.map(
          (value) => [`payload/movement-patterns/${value.id}.json`, value] as const,
        ),
        ...p.formations.map(
          (value) => [`payload/formations/${value.id}.json`, value] as const,
        ),
        ...p.encounters.map(
          (value) => [`payload/encounters/${value.id}.json`, value] as const,
        ),
        ...p.bosses.map((value) => [`payload/bosses/${value.id}.json`, value] as const),
        ...p.pickups.map((value) => [`payload/pickups/${value.id}.json`, value] as const),
        ...p.equipment.map(
          (value) => [`payload/equipment/${value.id}.json`, value] as const,
        ),
      ];
    }
    case 'skyforge-music-pack': {
      const p = pkg.payload;
      return [
        ...p.cues.map((value) => [`payload/cues/${value.id}.json`, value] as const),
        ...p.instruments.map(
          (value) => [`payload/instruments/${value.id}.json`, value] as const,
        ),
        ...p.compositions.map(
          (value) => [`payload/compositions/${value.id}.json`, value] as const,
        ),
      ];
    }
    case 'skyforge-asset-pack': {
      const p = pkg.payload;
      return [
        ...p.assets.map((value) => [`payload/assets/${value.id}.json`, value] as const),
        ...p.tilesets.map(
          (value) => [`payload/tilesets/${value.id}.json`, value] as const,
        ),
        ...p.atlases.map((value) => [`payload/atlases/${value.id}.json`, value] as const),
      ];
    }
  }
}

async function put(root: string, path: string, data: string | Uint8Array): Promise<void> {
  const full = safeOutputPath(root, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
}

async function isNonEmptyDirectory(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (!info.isDirectory()) return true;
    return (await readdir(path)).length > 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function unpackPackage(
  sourceFile: string,
  targetDirectory: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const source = resolve(sourceFile);
  const target = resolve(targetDirectory);

  // Complete schema + semantic validation happens before any destructive operation.
  const pkg = parseStudioPackage(await readFile(source, 'utf8'));
  const categoryEntries = categories(pkg).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  categoryEntries.forEach(([path]) => safeOutputPath(target, path));

  const resourceFiles = new Set<string>();
  const preparedResources = pkg.resources.map((resource) => {
    if (!resource.embeddedData) return { resource, file: undefined };
    const extension = extname(resource.uri) || '.bin';
    const filename = sanitizeResourceFilename(
      resource.filename || `${resource.id}${extension}`,
    );
    const normalizedKey = filename.toLocaleLowerCase('en-US');
    if (resourceFiles.has(normalizedKey))
      throw new Error(`Duplicate normalized resource filename: ${filename}`);
    resourceFiles.add(normalizedKey);
    const file = `resources/${filename}`;
    safeOutputPath(target, file);
    return { resource, file };
  });

  if (await isNonEmptyDirectory(target)) {
    if (!options.force)
      throw new Error(
        `Target directory is not empty: ${target}. Re-run with --force to replace it.`,
      );
    await rm(target, { recursive: true, force: true });
  }
  await mkdir(target, { recursive: true });

  await put(
    target,
    'skyforge.package.json',
    json({
      format: pkg.format,
      schemaVersion: pkg.schemaVersion,
      manifest: pkg.manifest,
      reviewComments: pkg.reviewComments,
    }),
  );

  const resourceIndex: Record<string, unknown>[] = [];
  for (const { resource, file } of preparedResources) {
    const { embeddedData, ...metadata } = resource;
    if (!file || !embeddedData) {
      resourceIndex.push(metadata);
      continue;
    }
    resourceIndex.push({ ...metadata, file });
    await put(target, file, Buffer.from(embeddedData, 'base64'));
  }
  await put(target, 'resources/index.json', json(resourceIndex));
  await put(target, 'payload/index.json', json(orderIndex(pkg)));
  for (const [path, value] of categoryEntries) await put(target, path, json(value));
}

async function walk(root: string, directory: string): Promise<string[]> {
  const safeDirectory = safeOutputPath(root, relative(root, resolve(directory)) || '.');
  const found: string[] = [];
  for (const name of (await readdir(safeDirectory)).sort()) {
    const full = safeOutputPath(root, relative(root, resolve(safeDirectory, name)));
    const info = await lstat(full);
    if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${full}`);
    if (info.isDirectory()) found.push(...(await walk(root, full)));
    else found.push(full);
  }
  return found;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function under(
  source: string,
  prefix: string,
  order: string[] = [],
): Promise<unknown[]> {
  const directory = safeOutputPath(source, prefix);
  try {
    const values = await Promise.all(
      (await walk(source, directory))
        .filter((path) => path.endsWith('.json'))
        .sort()
        .map((path) => readJson(path)),
    );
    const rank = new Map(order.map((id, index) => [id, index]));
    return values.sort((left, right) => {
      const leftId =
        typeof left === 'object' && left && 'id' in left ? String(left.id) : '';
      const rightId =
        typeof right === 'object' && right && 'id' in right ? String(right.id) : '';
      return (
        (rank.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(rightId) ?? Number.MAX_SAFE_INTEGER)
      );
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function packFolder(sourceDirectory: string, targetFile: string): Promise<void> {
  const source = resolve(sourceDirectory);
  const target = resolve(targetFile);
  const header = recordValue(
    await readJson(safeOutputPath(source, 'skyforge.package.json')),
  );
  const indexValue = await readJson(safeOutputPath(source, 'resources/index.json'));
  if (!Array.isArray(indexValue)) throw new Error('resources/index.json must be an array');
  const order = recordValue(
    await readJson(safeOutputPath(source, 'payload/index.json')).catch(() => ({})),
  );
  const resources: Record<string, unknown>[] = [];
  for (const rawEntry of indexValue) {
    const entry = recordValue(rawEntry);
    const file = typeof entry.file === 'string' ? entry.file : undefined;
    const { file: _file, ...metadata } = entry;
    resources.push(
      file
        ? {
            ...metadata,
            embeddedData: (
              await readFile(safeOutputPath(source, file))
            ).toString('base64'),
          }
        : metadata,
    );
  }

  let payload: Record<string, unknown>;
  switch (header.format) {
    case 'skyforge-level-pack':
      payload = {
        campaign: await readJson(safeOutputPath(source, 'payload/campaign.json')).catch(
          () => undefined,
        ),
        levels: await under(source, 'payload/levels', stringArray(order.levels)),
        levelPackages: await under(
          source,
          'payload/level-packages',
          stringArray(order['level-packages']),
        ),
        maps: await under(source, 'payload/maps', stringArray(order.maps)),
        collisions: await under(
          source,
          'payload/collisions',
          stringArray(order.collisions),
        ),
        routes: await under(source, 'payload/routes', stringArray(order.routes)),
        objects: await under(source, 'payload/objects', stringArray(order.objects)),
        biomes: await under(source, 'payload/biomes', stringArray(order.biomes)),
      };
      break;
    case 'skyforge-tuning-pack': {
      const profile = recordValue(
        await readJson(safeOutputPath(source, 'payload/profile.json')),
      );
      payload = {
        profileId: profile.profileId,
        difficulty: await readJson(safeOutputPath(source, 'payload/difficulty.json')),
        enemies: await under(source, 'payload/enemies', stringArray(order.enemies)),
        weapons: await under(source, 'payload/weapons', stringArray(order.weapons)),
        projectilePatterns: await under(
          source,
          'payload/projectile-patterns',
          stringArray(order['projectile-patterns']),
        ),
        movementPatterns: await under(
          source,
          'payload/movement-patterns',
          stringArray(order['movement-patterns']),
        ),
        formations: await under(
          source,
          'payload/formations',
          stringArray(order.formations),
        ),
        encounters: await under(
          source,
          'payload/encounters',
          stringArray(order.encounters),
        ),
        bosses: await under(source, 'payload/bosses', stringArray(order.bosses)),
        pickups: await under(source, 'payload/pickups', stringArray(order.pickups)),
        equipment: await under(
          source,
          'payload/equipment',
          stringArray(order.equipment),
        ),
      };
      break;
    }
    case 'skyforge-music-pack':
      payload = {
        cues: await under(source, 'payload/cues', stringArray(order.cues)),
        instruments: await under(
          source,
          'payload/instruments',
          stringArray(order.instruments),
        ),
        compositions: await under(
          source,
          'payload/compositions',
          stringArray(order.compositions),
        ),
      };
      break;
    case 'skyforge-asset-pack':
      payload = {
        assets: await under(source, 'payload/assets', stringArray(order.assets)),
        tilesets: await under(source, 'payload/tilesets', stringArray(order.tilesets)),
        atlases: await under(source, 'payload/atlases', stringArray(order.atlases)),
      };
      break;
    default:
      throw new Error(`Unsupported package format ${String(header.format)}`);
  }

  const pkg = parseStudioPackage(json({ ...header, resources, payload }));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, json(pkg));
}

async function main(): Promise<void> {
  const [, , command, sourceArg, targetArg, ...flags] = process.argv;
  if (!['unpack', 'pack'].includes(command ?? '') || !sourceArg || !targetArg) {
    console.error(
      'Usage: tsx scripts/studio-folder.ts <unpack|pack> <source> <target> [--force]',
    );
    process.exitCode = 2;
    return;
  }
  if (command === 'unpack') {
    await unpackPackage(sourceArg, targetArg, { force: flags.includes('--force') });
    console.log(`Unpacked ${basename(sourceArg)} -> ${resolve(targetArg)}`);
  } else {
    await packFolder(sourceArg, targetArg);
    console.log(`Packed ${relative(process.cwd(), resolve(sourceArg))} -> ${resolve(targetArg)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
