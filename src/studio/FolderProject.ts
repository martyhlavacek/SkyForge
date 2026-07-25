import type { StudioPackage, StudioResource } from '../schemas/studioPackageSchema';
import { parseStudioPackage, stableStringify } from './PackageCodec';

export interface StudioFolderFile {
  path: string;
  kind: 'text' | 'binary';
  text?: string;
  bytes?: Uint8Array;
}

interface FolderHeader {
  format: StudioPackage['format'];
  schemaVersion: number;
  manifest: StudioPackage['manifest'];
  reviewComments: StudioPackage['reviewComments'];
}

interface ResourceIndexEntry extends Omit<StudioResource, 'embeddedData'> {
  file?: string;
}

function jsonFile(path: string, value: unknown): StudioFolderFile {
  return { path, kind: 'text', text: `${JSON.stringify(value, null, 2)}\n` };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk)
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}

function safeFilename(resource: StudioResource): string {
  const provided = resource.filename?.replace(/[/\\]/g, '-');
  if (provided) return provided;
  const extension =
    resource.mediaType === 'image/png'
      ? '.png'
      : resource.mediaType === 'image/webp'
        ? '.webp'
        : resource.mediaType.includes('wav')
          ? '.wav'
          : resource.mediaType.includes('ogg')
            ? '.ogg'
            : '.bin';
  return `${resource.id}${extension}`;
}

function payloadOrderIndex(pkg: StudioPackage): Record<string, string[]> {
  switch (pkg.format) {
    case 'skyforge-level-pack':
      return {
        levels: pkg.payload.levels.map((item) => item.id),
        'level-packages': pkg.payload.levelPackages.map((item) => item.id),
        maps: pkg.payload.maps.map((item) => item.id),
        collisions: pkg.payload.collisions.map((item) => item.id),
        routes: pkg.payload.routes.map((item) => item.id),
        objects: pkg.payload.objects.map((item) => item.id),
        biomes: pkg.payload.biomes.map((item) => item.id),
      };
    case 'skyforge-tuning-pack':
      return {
        enemies: pkg.payload.enemies.map((item) => item.id),
        weapons: pkg.payload.weapons.map((item) => item.id),
        'projectile-patterns': pkg.payload.projectilePatterns.map((item) => item.id),
        'movement-patterns': pkg.payload.movementPatterns.map((item) => item.id),
        formations: pkg.payload.formations.map((item) => item.id),
        encounters: pkg.payload.encounters.map((item) => item.id),
        bosses: pkg.payload.bosses.map((item) => item.id),
        pickups: pkg.payload.pickups.map((item) => item.id),
        equipment: pkg.payload.equipment.map((item) => item.id),
      };
    case 'skyforge-music-pack':
      return {
        cues: pkg.payload.cues.map((item) => item.id),
        instruments: pkg.payload.instruments.map((item) => item.id),
        compositions: pkg.payload.compositions.map((item) => item.id),
      };
    case 'skyforge-asset-pack':
      return {
        assets: pkg.payload.assets.map((item) => item.id),
        tilesets: pkg.payload.tilesets.map((item) => item.id),
        atlases: pkg.payload.atlases.map((item) => item.id),
      };
  }
}

function payloadFiles(pkg: StudioPackage): StudioFolderFile[] {
  switch (pkg.format) {
    case 'skyforge-level-pack': {
      const p = pkg.payload;
      return [
        ...(p.campaign ? [jsonFile('payload/campaign.json', p.campaign)] : []),
        ...p.levels.map((item) => jsonFile(`payload/levels/${item.id}.json`, item)),
        ...p.levelPackages.map((item) =>
          jsonFile(`payload/level-packages/${item.id}.json`, item),
        ),
        ...p.maps.map((item) => jsonFile(`payload/maps/${item.id}.json`, item)),
        ...p.collisions.map((item) =>
          jsonFile(`payload/collisions/${item.id}.json`, item),
        ),
        ...p.routes.map((item) => jsonFile(`payload/routes/${item.id}.json`, item)),
        ...p.objects.map((item) => jsonFile(`payload/objects/${item.id}.json`, item)),
        ...p.biomes.map((item) => jsonFile(`payload/biomes/${item.id}.json`, item)),
      ];
    }
    case 'skyforge-tuning-pack': {
      const p = pkg.payload;
      const singular = [
        jsonFile('payload/profile.json', { profileId: p.profileId }),
        jsonFile('payload/difficulty.json', p.difficulty),
      ];
      const groups: [string, { id: string }[]][] = [
        ['enemies', p.enemies],
        ['weapons', p.weapons],
        ['projectile-patterns', p.projectilePatterns],
        ['movement-patterns', p.movementPatterns],
        ['formations', p.formations],
        ['encounters', p.encounters],
        ['bosses', p.bosses],
        ['pickups', p.pickups],
        ['equipment', p.equipment],
      ];
      return [
        ...singular,
        ...groups.flatMap(([directory, values]) =>
          values.map((item) => jsonFile(`payload/${directory}/${item.id}.json`, item)),
        ),
      ];
    }
    case 'skyforge-music-pack':
      return [
        ...pkg.payload.cues.map((item) => jsonFile(`payload/cues/${item.id}.json`, item)),
        ...pkg.payload.instruments.map((item) =>
          jsonFile(`payload/instruments/${item.id}.json`, item),
        ),
        ...pkg.payload.compositions.map((item) =>
          jsonFile(`payload/compositions/${item.id}.json`, item),
        ),
      ];
    case 'skyforge-asset-pack':
      return [
        ...pkg.payload.assets.map((item) =>
          jsonFile(`payload/assets/${item.id}.json`, item),
        ),
        ...pkg.payload.tilesets.map((item) =>
          jsonFile(`payload/tilesets/${item.id}.json`, item),
        ),
        ...pkg.payload.atlases.map((item) =>
          jsonFile(`payload/atlases/${item.id}.json`, item),
        ),
      ];
  }
}

export function studioPackageToFolderFiles(pkg: StudioPackage): StudioFolderFile[] {
  const header: FolderHeader = {
    format: pkg.format,
    schemaVersion: pkg.schemaVersion,
    manifest: pkg.manifest,
    reviewComments: pkg.reviewComments,
  };
  const files: StudioFolderFile[] = [jsonFile('skyforge.package.json', header)];
  const resourceIndex: ResourceIndexEntry[] = [];
  pkg.resources.forEach((resource) => {
    const { embeddedData, ...metadata } = resource;
    if (!embeddedData) {
      resourceIndex.push(metadata);
      return;
    }
    const filename = safeFilename(resource);
    resourceIndex.push({ ...metadata, file: `resources/${filename}` });
    files.push({
      path: `resources/${filename}`,
      kind: 'binary',
      bytes: decodeBase64(embeddedData),
    });
  });
  files.push(jsonFile('resources/index.json', resourceIndex));
  files.push(jsonFile('payload/index.json', payloadOrderIndex(pkg)));
  files.push(...payloadFiles(pkg));
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function parseJson(file: StudioFolderFile | undefined, label: string): unknown {
  if (!file?.text) throw new Error(`Folder project is missing ${label}`);
  return JSON.parse(file.text) as unknown;
}

function valuesUnder(
  files: Map<string, StudioFolderFile>,
  prefix: string,
  order: string[] = [],
): unknown[] {
  const values = [...files.entries()]
    .filter(([path]) => path.startsWith(prefix) && path.endsWith('.json'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, file]) => parseJson(file, prefix) as { id?: string });
  if (!order.length) return values;
  const rank = new Map(order.map((id, index) => [id, index]));
  return values.sort(
    (a, b) =>
      (rank.get(a.id ?? '') ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.id ?? '') ?? Number.MAX_SAFE_INTEGER),
  );
}

export function studioPackageFromFolderFiles(entries: StudioFolderFile[]): StudioPackage {
  const files = new Map(entries.map((entry) => [entry.path.replace(/^\.\//, ''), entry]));
  const header = parseJson(
    files.get('skyforge.package.json'),
    'skyforge.package.json',
  ) as FolderHeader;
  const resourceIndex = parseJson(
    files.get('resources/index.json'),
    'resources/index.json',
  ) as ResourceIndexEntry[];
  const orderIndex = files.has('payload/index.json')
    ? (parseJson(files.get('payload/index.json'), 'payload/index.json') as Record<
        string,
        string[]
      >)
    : {};
  const resources = resourceIndex.map(({ file, ...metadata }) => {
    if (!file) return metadata;
    const resourceFile = files.get(file);
    if (!resourceFile?.bytes) throw new Error(`Folder project is missing ${file}`);
    return { ...metadata, embeddedData: encodeBase64(resourceFile.bytes) };
  });
  const common = {
    format: header.format,
    schemaVersion: header.schemaVersion,
    manifest: header.manifest,
    reviewComments: header.reviewComments ?? [],
    resources,
  };
  let candidate: unknown;
  switch (header.format) {
    case 'skyforge-level-pack':
      candidate = {
        ...common,
        payload: {
          campaign: files.has('payload/campaign.json')
            ? parseJson(files.get('payload/campaign.json'), 'payload/campaign.json')
            : undefined,
          levels: valuesUnder(files, 'payload/levels/', orderIndex.levels),
          levelPackages: valuesUnder(
            files,
            'payload/level-packages/',
            orderIndex['level-packages'],
          ),
          maps: valuesUnder(files, 'payload/maps/', orderIndex.maps),
          collisions: valuesUnder(files, 'payload/collisions/', orderIndex.collisions),
          routes: valuesUnder(files, 'payload/routes/', orderIndex.routes),
          objects: valuesUnder(files, 'payload/objects/', orderIndex.objects),
          biomes: valuesUnder(files, 'payload/biomes/', orderIndex.biomes),
        },
      };
      break;
    case 'skyforge-tuning-pack': {
      const profile = parseJson(
        files.get('payload/profile.json'),
        'payload/profile.json',
      ) as {
        profileId: string;
      };
      candidate = {
        ...common,
        payload: {
          profileId: profile.profileId,
          difficulty: parseJson(
            files.get('payload/difficulty.json'),
            'payload/difficulty.json',
          ),
          enemies: valuesUnder(files, 'payload/enemies/', orderIndex.enemies),
          weapons: valuesUnder(files, 'payload/weapons/', orderIndex.weapons),
          projectilePatterns: valuesUnder(
            files,
            'payload/projectile-patterns/',
            orderIndex['projectile-patterns'],
          ),
          movementPatterns: valuesUnder(
            files,
            'payload/movement-patterns/',
            orderIndex['movement-patterns'],
          ),
          formations: valuesUnder(files, 'payload/formations/', orderIndex.formations),
          encounters: valuesUnder(files, 'payload/encounters/', orderIndex.encounters),
          bosses: valuesUnder(files, 'payload/bosses/', orderIndex.bosses),
          pickups: valuesUnder(files, 'payload/pickups/', orderIndex.pickups),
          equipment: valuesUnder(files, 'payload/equipment/', orderIndex.equipment),
        },
      };
      break;
    }
    case 'skyforge-music-pack':
      candidate = {
        ...common,
        payload: {
          cues: valuesUnder(files, 'payload/cues/', orderIndex.cues),
          instruments: valuesUnder(files, 'payload/instruments/', orderIndex.instruments),
          compositions: valuesUnder(
            files,
            'payload/compositions/',
            orderIndex.compositions,
          ),
        },
      };
      break;
    case 'skyforge-asset-pack':
      candidate = {
        ...common,
        payload: {
          assets: valuesUnder(files, 'payload/assets/', orderIndex.assets),
          tilesets: valuesUnder(files, 'payload/tilesets/', orderIndex.tilesets),
          atlases: valuesUnder(files, 'payload/atlases/', orderIndex.atlases),
        },
      };
      break;
    default:
      throw new Error(`Unsupported folder package format ${String(header.format)}`);
  }
  return parseStudioPackage(`${stableStringify(candidate)}\n`);
}
