import { contentRegistry } from '../game/systems/ContentRegistry';
import {
  StudioAssetDefinitionSchema,
  StudioTilesetDefinitionSchema,
} from '../schemas/studioPackageSchema';
import type {
  AssetStudioPackage,
  LevelStudioPackage,
  MusicStudioPackage,
  StudioAssetDefinition,
  StudioAssetDefinitionInput,
  StudioPackage,
  StudioPackageManifest,
  StudioWorkspace,
  TuningStudioPackage,
} from '../schemas/studioPackageSchema';

const DEFAULT_TIMESTAMP = '2026-07-14T01:00:00.000Z';

function manifest(
  id: string,
  name: string,
  description: string,
  dependencies: StudioPackageManifest['dependencies'] = [],
  now = DEFAULT_TIMESTAMP,
): StudioPackageManifest {
  return {
    id,
    name,
    version: '1.0.0',
    description,
    authors: ['Marty Hlavacek'],
    license: 'Skyforge project content',
    engineRange: '>=0.3.0',
    dependencies,
    tags: ['built-in', 'epoch-18'],
    createdAt: now,
    updatedAt: now,
    contentRevision: 2,
  };
}

export function createBuiltInLevelPack(now = DEFAULT_TIMESTAMP): LevelStudioPackage {
  const levels = [...contentRegistry.levels.values()].map((value) =>
    structuredClone(value),
  );
  return {
    format: 'skyforge-level-pack',
    schemaVersion: 2,
    manifest: manifest(
      'skyforge-base-levels',
      'Skyforge Base Levels',
      'Built-in campaign levels and Level Package v2 terrain documents.',
      [
        {
          type: 'tuning',
          id: 'skyforge-standard-tuning',
          versionRange: '^1.0.0',
          optional: false,
        },
        {
          type: 'music',
          id: 'skyforge-base-music',
          versionRange: '^1.0.0',
          optional: false,
        },
        {
          type: 'asset',
          id: 'skyforge-placeholder-assets',
          versionRange: '^1.0.0',
          optional: false,
        },
      ],
      now,
    ),
    resources: [],
    reviewComments: [],
    payload: {
      campaign: {
        id: 'skyforge-campaign-alpha',
        displayName: 'Skyforge Campaign Alpha',
        levelOrder: levels.map((level) => level.id),
      },
      levels,
      levelPackages: [...contentRegistry.levelPackages.values()].map((value) =>
        structuredClone(value),
      ),
      maps: [...contentRegistry.terrainMaps.values()].map((value) =>
        structuredClone(value),
      ),
      collisions: [...contentRegistry.terrainCollisions.values()].map((value) =>
        structuredClone(value),
      ),
      routes: [...contentRegistry.routeSets.values()].map((value) =>
        structuredClone(value),
      ),
      objects: [...contentRegistry.terrainObjects.values()].map((value) =>
        structuredClone(value),
      ),
      biomes: [...contentRegistry.biomes.values()].map((value) => structuredClone(value)),
    },
  };
}

export function createBuiltInTuningPack(now = DEFAULT_TIMESTAMP): TuningStudioPackage {
  if (!contentRegistry.difficulty) throw new Error('difficulty content is not loaded');
  return {
    format: 'skyforge-tuning-pack',
    schemaVersion: 2,
    manifest: manifest(
      'skyforge-standard-tuning',
      'Skyforge Standard Tuning',
      'Combat, movement, encounters, equipment, and difficulty definitions.',
      [],
      now,
    ),
    resources: [],
    reviewComments: [],
    payload: {
      profileId: 'standard-balance-v1',
      difficulty: structuredClone(contentRegistry.difficulty),
      enemies: [...contentRegistry.enemies.values()].map((value) =>
        structuredClone(value),
      ),
      weapons: [...contentRegistry.weapons.values()].map((value) =>
        structuredClone(value),
      ),
      projectilePatterns: [...contentRegistry.projectilePatterns.values()].map((value) =>
        structuredClone(value),
      ),
      movementPatterns: [...contentRegistry.movement.values()].map((value) =>
        structuredClone(value),
      ),
      formations: [...contentRegistry.formations.values()].map((value) =>
        structuredClone(value),
      ),
      encounters: [...contentRegistry.encounters.values()].map((value) =>
        structuredClone(value),
      ),
      bosses: [...contentRegistry.bosses.values()].map((value) => structuredClone(value)),
      pickups: [...contentRegistry.pickups.values()].map((value) =>
        structuredClone(value),
      ),
      equipment: [...contentRegistry.equipment.values()].map((value) =>
        structuredClone(value),
      ),
    },
  };
}

export function createBuiltInMusicPack(now = DEFAULT_TIMESTAMP): MusicStudioPackage {
  const cues = [...contentRegistry.music.values()].map((value) => structuredClone(value));
  const resources: MusicStudioPackage['resources'] = [];
  const seen = new Set<string>();
  cues.forEach((cue) => {
    const values = [cue.fullMix, ...cue.stems.map((stem) => stem.asset)].filter(
      (value): value is string => Boolean(value),
    );
    values.forEach((uri) => {
      if (seen.has(uri)) return;
      seen.add(uri);
      resources.push({
        id: `audio-${resources.length + 1}`,
        uri,
        mediaType: uri.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg',
        license: 'Skyforge project content',
      });
    });
  });

  const instruments: MusicStudioPackage['payload']['instruments'] = [];
  const compositions: MusicStudioPackage['payload']['compositions'] = [];

  return {
    format: 'skyforge-music-pack',
    schemaVersion: 2,
    manifest: manifest(
      'skyforge-base-music',
      'Skyforge Base Music',
      'Runtime-ready adaptive cue definitions and verified audio resources. Music is authored externally.',
      [],
      now,
    ),
    resources,
    reviewComments: [],
    payload: { cues, instruments, compositions, tracks: [] },
  };
}

function addAsset(
  target: Map<string, StudioAssetDefinition>,
  definition: StudioAssetDefinitionInput,
): void {
  const parsed = StudioAssetDefinitionSchema.parse(definition);
  if (!target.has(parsed.id)) target.set(parsed.id, parsed);
}

export function createBuiltInAssetPack(now = DEFAULT_TIMESTAMP): AssetStudioPackage {
  const assets = new Map<string, StudioAssetDefinition>();
  const resources: AssetStudioPackage['resources'] = [
    {
      id: 'demo-fighter-sheet-resource',
      uri: 'assets/studio/demo_fighter_sheet.png',
      filename: 'demo_fighter_sheet.png',
      mediaType: 'image/png',
      sha256: '0bdb30642d43c8dab25c800ad35726a3aabb853f67f0ce54dd130312ee994ae9',
      bytes: 881,
      width: 192,
      height: 48,
      license: 'Skyforge project demonstration asset',
      attribution: 'Skyforge Epoch 14 procedural demo',
      provenance: {
        source: 'built-in-demo',
        author: 'Skyforge project',
        createdWith: 'Pillow',
        importedAt: now,
        notes: 'Four-frame fighter sheet for Asset Studio testing',
      },
    },
    {
      id: 'demo-fighter-shadow-resource',
      uri: 'assets/studio/demo_fighter_shadow.png',
      filename: 'demo_fighter_shadow.png',
      mediaType: 'image/png',
      sha256: '2a37b6f3e9aee052746935ba6d3fc5b6526232fe21f2d4fc82089613d10ac99c',
      bytes: 240,
      width: 48,
      height: 48,
      license: 'Skyforge project demonstration asset',
      attribution: 'Skyforge Epoch 14 procedural demo',
      provenance: {
        source: 'built-in-demo',
        author: 'Skyforge project',
        createdWith: 'Pillow',
        importedAt: now,
        notes: 'Aircraft shadow test asset',
      },
    },
    {
      id: 'skyforge-canyon-default-resource',
      uri: 'assets/terrain/skyforge_canyon_terrain.png',
      filename: 'skyforge_canyon_terrain.png',
      mediaType: 'image/png',
      sha256: '9d7d2af586ac37ff642e825b06cb4605f62ead563352333aaaa4762d3fd19b43',
      bytes: 361412,
      width: 512,
      height: 960,
      license: 'Skyforge project demonstration asset',
      attribution:
        'Generated for Skyforge in ChatGPT and normalized by the deterministic canyon tileset pipeline',
      provenance: {
        source: 'chatgpt-generated-master',
        author: 'Skyforge project',
        createdWith: 'External image generation and Pillow normalization',
        importedAt: now,
        notes:
          '480-frame terrain atlas with visibly curved inner corners, true 45-degree diagonal banks, connected exposed-edge shoreline overlays, four visual variants per Blob-47 state, and expanded environmental decoration frames',
      },
    },
    {
      id: 'skyforge-canyon-water-resource',
      uri: 'assets/terrain/skyforge_canyon_water.png',
      filename: 'skyforge_canyon_water.png',
      mediaType: 'image/png',
      sha256: '011bd83323516f6e69b2bb84cadef95265eac1ff5b167bc4609da50f55d21479',
      bytes: 315647,
      width: 1536,
      height: 512,
      license: 'Skyforge project demonstration asset',
      attribution: 'Procedurally generated for SkyForge Epoch 18',
      provenance: {
        source: 'built-in-demo',
        author: 'Skyforge project',
        createdWith: 'Pillow periodic texture generator',
        importedAt: now,
        notes: 'Three quiet 512x512 seamless water frames used by the continuous runtime TileSprite plane',
      },
    },
    {
      id: 'skyforge-canyon-sandstone-resource',
      uri: 'assets/terrain/skyforge_canyon_sandstone.png',
      filename: 'skyforge_canyon_sandstone.png',
      mediaType: 'image/png',
      sha256: 'cd454ad3eef7e27373c7cd49f7179e8c73122472bb6b699383fb09d5b6201dec',
      bytes: 315109,
      width: 512,
      height: 512,
      license: 'Skyforge project demonstration asset',
      attribution: 'Procedurally generated for SkyForge Epoch 18',
      provenance: {
        source: 'built-in-demo',
        author: 'Skyforge project',
        createdWith: 'Pillow periodic texture generator',
        importedAt: now,
        notes: 'Continuous 512x512 sandstone source composited through Blob-47 masks at runtime',
      },
    },
    {
      id: 'skyforge-canyon-props-resource',
      uri: 'assets/terrain/skyforge_canyon_props.png',
      filename: 'skyforge_canyon_props.png',
      mediaType: 'image/png',
      sha256: '72a6dd2364d3e584cd045ee5a00c8e6a6d2f3d56ecc7386b2adb5cf5f2b8a2b8',
      bytes: 131877,
      width: 512,
      height: 128,
      license: 'Skyforge project demonstration asset',
      attribution:
        'Generated for Skyforge in ChatGPT and normalized by the deterministic canyon tileset pipeline',
      provenance: {
        source: 'chatgpt-generated-master',
        author: 'Skyforge project',
        createdWith: 'External image generation and Pillow normalization',
        importedAt: now,
        notes:
          'Canyon rocks, vegetation, structures, gates, and river-channel prop frames',
      },
    },
  ];

  addAsset(assets, {
    id: 'demo_fighter_epoch14',
    displayName: 'Epoch 14 Demo Fighter',
    kind: 'enemyAircraft',
    status: 'approved',
    roles: ['enemy-visual', 'asset-studio-demo'],
    tags: ['demo', 'animated', 'aircraft'],
    resourceId: 'demo-fighter-sheet-resource',
    width: 48,
    height: 48,
    scale: 1,
    pivot: { x: 0.5, y: 0.48 },
    frames: Array.from({ length: 4 }, (_, index) => ({
      id: `demo_fighter_epoch14-frame-${index}`,
      x: index * 48,
      y: 0,
      width: 48,
      height: 48,
      durationMs: 100,
    })),
    collision: { type: 'circle', radius: 13, offsetX: 0, offsetY: 2 },
    hardpoints: [
      { id: 'primary-left', kind: 'primary', x: 16, y: 29, rotation: 0, mirrored: true },
      { id: 'primary-right', kind: 'primary', x: 32, y: 29, rotation: 0, mirrored: true },
      { id: 'engine', kind: 'engine', x: 24, y: 43, rotation: 180, mirrored: false },
    ],
    presentation: {
      altitude: 36,
      shadowAssetId: 'demo_fighter_shadow_epoch14',
      shadowOffsetX: 10,
      shadowOffsetY: 14,
      shadowScaleX: 1,
      shadowScaleY: 0.65,
      shadowOpacity: 0.38,
    },
    animations: { idle: { frames: [0, 1, 2, 3], fps: 8, loop: true } },
    atlasFrameIds: [],
  });
  addAsset(assets, {
    id: 'demo_fighter_shadow_epoch14',
    displayName: 'Epoch 14 Demo Fighter Shadow',
    kind: 'shadow',
    status: 'approved',
    roles: ['aircraft-shadow'],
    tags: ['demo', 'shadow'],
    resourceId: 'demo-fighter-shadow-resource',
    width: 48,
    height: 48,
    pivot: { x: 0.5, y: 0.5 },
    frames: [
      {
        id: 'demo_fighter_shadow_epoch14-frame-0',
        x: 0,
        y: 0,
        width: 48,
        height: 48,
        durationMs: 100,
      },
    ],
    presentation: {
      altitude: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowScaleX: 1,
      shadowScaleY: 1,
      shadowOpacity: 1,
    },
    animations: { idle: { frames: [0], fps: 1, loop: true } },
  });
  addAsset(assets, {
    id: 'skyforge_canyon_water_plane',
    displayName: 'Skyforge Canyon Continuous Water Plane',
    kind: 'terrainTile',
    status: 'approved',
    roles: ['terrain-material', 'water-plane'],
    tags: ['canyon', 'water', 'seamless', 'animated'],
    resourceId: 'skyforge-canyon-water-resource',
    width: 512,
    height: 512,
    pivot: { x: 0, y: 0 },
    frames: [
      { id: 'skyforge-canyon-water-frame-0', x: 0, y: 0, width: 512, height: 512, durationMs: 1538 },
      { id: 'skyforge-canyon-water-frame-1', x: 512, y: 0, width: 512, height: 512, durationMs: 1538 },
      { id: 'skyforge-canyon-water-frame-2', x: 1024, y: 0, width: 512, height: 512, durationMs: 1538 },
    ],
    presentation: {
      altitude: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowScaleX: 1,
      shadowScaleY: 1,
      shadowOpacity: 0,
    },
    animations: { idle: { frames: [0, 1, 2], fps: 0.65, loop: true } },
  });
  addAsset(assets, {
    id: 'skyforge_canyon_sandstone_plane',
    displayName: 'Skyforge Canyon Continuous Sandstone',
    kind: 'terrainTile',
    status: 'approved',
    roles: ['terrain-material', 'sandstone-plane'],
    tags: ['canyon', 'sandstone', 'seamless', 'composited'],
    resourceId: 'skyforge-canyon-sandstone-resource',
    width: 512,
    height: 512,
    pivot: { x: 0, y: 0 },
    frames: [{ id: 'skyforge-canyon-sandstone-frame-0', x: 0, y: 0, width: 512, height: 512, durationMs: 100 }],
    presentation: { altitude: 0, shadowOffsetX: 0, shadowOffsetY: 0, shadowScaleX: 1, shadowScaleY: 1, shadowOpacity: 0 },
    animations: {},
  });
  addAsset(assets, {
    id: 'skyforge_canyon_props',
    displayName: 'Skyforge Canyon Props Atlas',
    kind: 'terrainTile',
    status: 'approved',
    roles: ['terrain-decoration', 'canyon-props'],
    tags: ['canyon', 'props', 'structures', 'vegetation'],
    resourceId: 'skyforge-canyon-props-resource',
    width: 512,
    height: 128,
    pivot: { x: 0, y: 0 },
    frames: Array.from({ length: 64 }, (_, index) => ({
      id: `skyforge-canyon-prop-${index}`,
      x: (index % 16) * 32,
      y: Math.floor(index / 16) * 32,
      width: 32,
      height: 32,
      durationMs: 100,
    })),
    presentation: {
      altitude: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowScaleX: 1,
      shadowScaleY: 1,
      shadowOpacity: 0,
    },
    animations: {},
  });

  contentRegistry.enemies.forEach((enemy) =>
    addAsset(assets, {
      id: enemy.sprite,
      displayName: `${enemy.displayName} Placeholder`,
      kind: enemy.id === 'mine' ? 'effect' : 'enemyAircraft',
      roles: ['enemy-visual', enemy.id],
      sourceKey: enemy.sprite,
      width: Math.ceil(enemy.hitbox.radius * 2.5),
      height: Math.ceil(enemy.hitbox.radius * 2.5),
      pivot: { x: 0.5, y: 0.5 },
      collision: { type: 'circle', radius: enemy.hitbox.radius, offsetX: 0, offsetY: 0 },
      presentation: {
        altitude: enemy.id === 'mine' ? 4 : 32,
        shadowOffsetX: enemy.id === 'mine' ? 2 : 10,
        shadowOffsetY: enemy.id === 'mine' ? 3 : 14,
      },
      animations: {},
    }),
  );
  contentRegistry.equipment.forEach((equipment) =>
    addAsset(assets, {
      id: equipment.iconKey,
      displayName: `${equipment.displayName} Icon`,
      kind: 'ui',
      roles: ['equipment-icon', equipment.category],
      sourceKey: equipment.iconKey,
      width: 32,
      height: 32,
      pivot: { x: 0.5, y: 0.5 },
      presentation: {
        altitude: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowScaleX: 1,
        shadowScaleY: 0.65,
        shadowOpacity: 0.35,
      },
      animations: {},
    }),
  );
  addAsset(assets, {
    id: 'player_ship',
    displayName: 'Player Ship Placeholder',
    kind: 'playerShip',
    roles: ['player-visual'],
    sourceKey: 'player_ship',
    width: 48,
    height: 48,
    pivot: { x: 0.5, y: 0.5 },
    collision: { type: 'circle', radius: 14, offsetX: 0, offsetY: 0 },
    presentation: {
      altitude: 38,
      shadowOffsetX: 14,
      shadowOffsetY: 18,
      shadowScaleX: 0.92,
      shadowScaleY: 0.48,
      shadowOpacity: 0.42,
    },
    animations: {},
  });
  addAsset(assets, {
    id: 'equipment_placeholder',
    displayName: 'Equipment Placeholder',
    kind: 'ui',
    roles: ['fallback-icon'],
    sourceKey: 'equipment_placeholder',
    width: 32,
    height: 32,
    pivot: { x: 0.5, y: 0.5 },
    presentation: {
      altitude: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowScaleX: 1,
      shadowScaleY: 0.65,
      shadowOpacity: 0.35,
    },
    animations: {},
  });

  const tilesets: AssetStudioPackage['payload']['tilesets'] = [];
  contentRegistry.biomes.forEach((biome) => {
    biome.materials.forEach((material) =>
      addAsset(assets, {
        id: `terrain-${biome.id}-${material.id}`,
        displayName: `${biome.displayName}: ${material.displayName}`,
        kind: 'terrainTile',
        roles: ['terrain-material', material.collisionRole],
        sourceKey: `${biome.id}:${material.tile}`,
        width: 32,
        height: 32,
        pivot: { x: 0, y: 0 },
        presentation: {
          altitude: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          shadowScaleX: 1,
          shadowScaleY: 0.65,
          shadowOpacity: 0.35,
        },
        animations: material.animated
          ? { idle: { frames: [0, 1, 2, 3], fps: 8, loop: true } }
          : {},
      }),
    );
    tilesets.push(
      StudioTilesetDefinitionSchema.parse({
        id: `${biome.id}-procedural-tileset`,
        displayName: `${biome.displayName} Procedural Tiles`,
        tileSize: 32,
        columns: 17,
        rows: Math.max(1, Math.ceil(biome.materials.length / 17)),
        materialIds: biome.materials.map((material) => material.id),
        margin: 0,
        spacing: 0,
        autotileRule: 'cardinal',
        autotileMappings: Object.fromEntries(
          Array.from({ length: 16 }, (_, index) => [String(index), index]),
        ),
        tiles: biome.materials.map((material, index) => ({
          index,
          materialId: material.id,
          collisionRole:
            material.collisionRole === 'solid'
              ? 'solid'
              : material.collisionRole === 'hazard'
                ? 'hazard'
                : 'none',
          animationFrames: material.animated
            ? [index, index + 1, index + 2, index + 3]
            : [],
          animationFps: 8,
        })),
      }),
    );
  });

  const canyonBiome = contentRegistry.biomes.get('canyon');
  const boundaryFrames =
    canyonBiome?.tileset?.materials.find(
      (material) => material.materialId === 'sandstone_boundary',
    )?.blob47Frames ?? {};
  const shorelineFrames =
    canyonBiome?.tileset?.materials.find(
      (material) => material.materialId === 'shoreline',
    )?.blob47Frames ?? {};

  const firstAutotileFrame = (value: number | number[]): number =>
    Array.isArray(value) ? value[0] : value;
  const flattenFrameMapping = (mapping: Record<string, number | number[]>): number[] =>
    Object.values(mapping).flatMap((value) => (Array.isArray(value) ? value : [value]));
  const canyonFrameGroups = {
    rockCluster:
      canyonBiome?.tileset?.materials.find((material) => material.materialId === 'rock_cluster')
        ?.baseFrames ?? [],
    crack:
      canyonBiome?.tileset?.materials.find((material) => material.materialId === 'crack')
        ?.baseFrames ?? [],
    scrub:
      canyonBiome?.tileset?.materials.find((material) => material.materialId === 'scrub')
        ?.baseFrames ?? [],
    sediment:
      canyonBiome?.tileset?.materials.find((material) => material.materialId === 'sediment')
        ?.baseFrames ?? [],
    ruin:
      canyonBiome?.tileset?.materials.find((material) => material.materialId === 'ruin')
        ?.baseFrames ?? [],
    metalPlatform:
      canyonBiome?.tileset?.materials.find(
        (material) => material.materialId === 'metal_platform',
      )?.baseFrames ?? [],
  };

  tilesets.unshift(
    StudioTilesetDefinitionSchema.parse({
      id: 'skyforge-canyon-default',
      displayName: 'Skyforge Canyon Default',
      resourceId: 'skyforge-canyon-default-resource',
      tileSize: 32,
      columns: canyonBiome?.tileset?.columns ?? 16,
      rows: canyonBiome?.tileset?.rows ?? 30,
      margin: 0,
      spacing: 0,
      materialIds: [
        'sandstone-boundary',
        'shoreline',
        'rock-cluster',
        'crack',
        'scrub',
        'sediment',
        'ruin',
        'metal-platform',
      ],
      autotileRule: 'blob47',
      autotileMappings: Object.fromEntries(
        Object.entries(boundaryFrames).map(([mask, frame]) => [
          mask,
          firstAutotileFrame(frame),
        ]),
      ),
      tiles: [
        ...flattenFrameMapping(boundaryFrames).map((index) => ({
          index,
          materialId: 'sandstone-boundary',
          collisionRole: 'none' as const,
          animationFrames: [],
          animationFps: 8,
        })),
        ...flattenFrameMapping(shorelineFrames).map((index) => ({
          index,
          materialId: 'shoreline',
          collisionRole: 'none' as const,
          animationFrames: [],
          animationFps: 8,
        })),
        ...canyonFrameGroups.rockCluster.map((index) => ({ index, materialId: 'rock-cluster', collisionRole: 'none' as const, animationFrames: [], animationFps: 8 })),
        ...canyonFrameGroups.crack.map((index) => ({ index, materialId: 'crack', collisionRole: 'none' as const, animationFrames: [], animationFps: 8 })),
        ...canyonFrameGroups.scrub.map((index) => ({ index, materialId: 'scrub', collisionRole: 'none' as const, animationFrames: [], animationFps: 8 })),
        ...canyonFrameGroups.sediment.map((index) => ({ index, materialId: 'sediment', collisionRole: 'none' as const, animationFrames: [], animationFps: 8 })),
        ...canyonFrameGroups.ruin.map((index) => ({ index, materialId: 'ruin', collisionRole: 'none' as const, animationFrames: [], animationFps: 8 })),
        ...canyonFrameGroups.metalPlatform.map((index) => ({
          index,
          materialId: 'metal-platform',
          collisionRole: 'none' as const,
          animationFrames: [],
          animationFps: 8,
        })),
      ],
    }),
  );
  return {
    format: 'skyforge-asset-pack',
    schemaVersion: 2,
    manifest: manifest(
      'skyforge-placeholder-assets',
      'Skyforge Placeholder Assets',
      'Production Asset Studio package with semantic placeholders, import, animation, shadow, atlas, and tileset demonstrations.',
      [],
      now,
    ),
    resources,
    reviewComments: [],
    payload: {
      assets: [...assets.values()],
      tilesets,
      atlases: [],
    },
  };
}

export function createBuiltInStudioPackages(now = DEFAULT_TIMESTAMP): StudioPackage[] {
  return [
    createBuiltInLevelPack(now),
    createBuiltInTuningPack(now),
    createBuiltInMusicPack(now),
    createBuiltInAssetPack(now),
  ];
}

export function createBuiltInWorkspace(now = DEFAULT_TIMESTAMP): StudioWorkspace {
  return {
    format: 'skyforge-workspace',
    schemaVersion: 2,
    id: 'skyforge-main-workspace',
    name: 'Skyforge Main Workspace',
    version: '1.0.0',
    packages: {
      level: { type: 'level', id: 'skyforge-base-levels', version: '1.0.0' },
      tuning: { type: 'tuning', id: 'skyforge-standard-tuning', version: '1.0.0' },
      music: { type: 'music', id: 'skyforge-base-music', version: '1.0.0' },
      asset: { type: 'asset', id: 'skyforge-placeholder-assets', version: '1.0.0' },
    },
    activeLevelId: 'level_01',
    updatedAt: now,
    reviewComments: [],
  };
}

import type { EditorProject } from '../editor/projectStore';
import { toLevelDef } from '../editor/levelStore';

/** Converts the current unsaved Level Studio project into one portable package. */
export function createLevelPackFromEditorProject(
  project: EditorProject,
  now = new Date().toISOString(),
): LevelStudioPackage {
  const level = toLevelDef(project.level);
  return {
    format: 'skyforge-level-pack',
    schemaVersion: 2,
    manifest: manifest(
      `${level.id}-level-pack`,
      `${level.displayName} Level Pack`,
      'Level Studio working copy exported through the Game Design Studio bridge.',
      [
        {
          type: 'tuning',
          id: 'skyforge-standard-tuning',
          versionRange: '^1.0.0',
          optional: false,
        },
        {
          type: 'music',
          id: 'skyforge-base-music',
          versionRange: '^1.0.0',
          optional: false,
        },
        {
          type: 'asset',
          id: 'skyforge-placeholder-assets',
          versionRange: '^1.0.0',
          optional: false,
        },
      ],
      now,
    ),
    resources: [],
    reviewComments: [],
    payload: {
      campaign: {
        id: `${level.id}-campaign`,
        displayName: level.displayName,
        levelOrder: [level.id],
      },
      levels: [level],
      levelPackages: project.packageDef ? [structuredClone(project.packageDef)] : [],
      maps: project.map ? [structuredClone(project.map)] : [],
      collisions: project.collision ? [structuredClone(project.collision)] : [],
      routes: project.routes ? [structuredClone(project.routes)] : [],
      objects: project.objects ? [structuredClone(project.objects)] : [],
      biomes: project.biome ? [structuredClone(project.biome)] : [],
    },
  };
}

export function editorProjectFromLevelPack(pkg: LevelStudioPackage): EditorProject {
  const level = pkg.payload.levels[0];
  if (!level) throw new Error('level package contains no levels');
  const packageDef = pkg.payload.levelPackages.find((item) => item.levelId === level.id);
  return {
    level: {
      ...structuredClone(level),
      events: level.events.map((value) => ({
        editorId:
          globalThis.crypto?.randomUUID?.() ??
          `event-${Math.random().toString(36).slice(2)}`,
        value: structuredClone(value),
      })),
    },
    packageDef: packageDef ? structuredClone(packageDef) : undefined,
    map: packageDef
      ? structuredClone(pkg.payload.maps.find((item) => item.id === packageDef.mapId))
      : undefined,
    collision: packageDef
      ? structuredClone(
          pkg.payload.collisions.find((item) => item.id === packageDef.collisionId),
        )
      : undefined,
    routes: packageDef
      ? structuredClone(
          pkg.payload.routes.find((item) => item.id === packageDef.routeSetId),
        )
      : undefined,
    objects: packageDef
      ? structuredClone(
          pkg.payload.objects.find((item) => item.id === packageDef.objectSetId),
        )
      : undefined,
    biome: packageDef
      ? structuredClone(pkg.payload.biomes.find((item) => item.id === packageDef.biomeId))
      : undefined,
  };
}
