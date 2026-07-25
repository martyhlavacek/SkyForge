# Epoch 17.4 — Default Canyon Tileset

## Purpose

Epoch 17.4 converts the generated desert-canyon source study into the first image-backed terrain set used directly by both the Skyforge Level Studio and the Phaser game runtime.

The release deliberately does **not** treat the generated 1254×1254 source image as a runtime atlas. It rebuilds selected source cells into strict, deterministic assets:

```text
Source master
    ↓ crop and normalize
512×256 terrain atlas (16×8, 128 frames)
512×128 props atlas   (16×4, 64 frames)
    ↓ explicit manifest and biome mapping
Level Studio + Phaser runtime + Asset Pack
```

## Delivered files

```text
art-source/skyforge_canyon_master.png
scripts/build-canyon-tileset.py
public/assets/terrain/skyforge_canyon_terrain.png
public/assets/terrain/skyforge_canyon_props.png
public/assets/terrain/skyforge_canyon_tileset.json
```

The source master is retained so the normalized atlas can be reproduced and revised without repeatedly sampling a lossy derivative.

## Terrain atlas layout

The terrain atlas is 512×256 pixels, with no margin or spacing. Every frame is exactly 32×32 pixels.

| Frame range | Purpose |
|---|---|
| 0 | Transparent/empty |
| 1–10 | Canyon floor variants |
| 11–15 | River animation and variation |
| 16–25 | River foam and shoreline variants |
| 26–31 | Reusable cliff-face strips |
| 32–47 | Cardinal-16 cliff mapping, mask 0–15 |
| 48–63 | Organic cliff-edge stamps |
| 64–79 | Metal platform and structure surfaces |
| 80–95 | Organic transition stamps A |
| 96–111 | Organic transition stamps B |
| 112–127 | Pits, caves and destructible-looking stamps |

The organic ranges are deliberately preserved for the next hybrid-autotiling revision. They can already be inspected in Asset Studio and used by future stamp/prefab tooling without regenerating the source art.

## Props atlas layout

The 512×128 props atlas contains 64 32×32 frames drawn from the lower source-master region:

- rocks and stone clusters;
- cacti and desert vegetation;
- bones and dead trees;
- industrial wall sections;
- doors, grates and gates;
- river-channel pieces.

The props atlas is registered as an approved Asset Studio resource. It is not yet exposed as a Level Studio stamp palette; that remains part of the planned prefab/stamp workflow.

## Runtime data model

The Canyon biome now carries an optional runtime tileset definition:

```ts
interface RuntimeTerrainTileset {
  id: string;
  displayName: string;
  uri: string;
  tileSize: 32;
  columns: number;
  rows: number;
  materials: RuntimeTerrainMaterial[];
}
```

Each logical material maps to one or more atlas frames. A material may define:

- deterministic base frames;
- a complete Cardinal-16 mapping;
- animation frames and frames per second.

The map remains authoritative as logical terrain data. It stores material tile IDs and, where applicable, Cardinal masks. It does not store image filenames or duplicate atlas coordinates.

## Frame resolution

`TerrainTileset.ts` provides the shared editor/runtime resolver.

Resolution order:

1. Use `cardinalFrames[variant]` when a cell carries a Cardinal-16 variant.
2. Use time-based animation frames for animated materials.
3. Choose a stable base frame using cell coordinates and the layer ID.
4. Fall back to the former procedural color renderer if the tileset or image is unavailable.

Stable coordinate hashing prevents visible randomization from changing between editor redraws, runtime sessions, scrolling chunks or exports.

## Level Studio integration

The Level Studio now:

- loads the biome atlas from the configured project-relative URI;
- draws exact source frames with image smoothing disabled;
- animates water and foam previews;
- shows real atlas thumbnails in the material browser;
- identifies the active image-backed tileset above the palette;
- retains color-swatch fallback behavior for imported legacy biomes;
- starts with a material already used by the initial active layer.

The default Canyon map includes a small metal-platform demonstration layer near the beginning of the level so that the new material can be seen immediately.

## Phaser runtime integration

`PreloadScene` loads every registered runtime terrain spritesheet before entering the menu.

`TerrainRuntime` retains its chunk-culling model, but each visible chunk now owns a container of atlas-backed tile images rather than only a procedural `Graphics` object. Animated tiles update their frame while the chunk is visible.

The procedural renderer remains in the same code path as a fallback. This protects imported projects and preview sessions when an image is unavailable or still migrating.

## Asset Studio and collaboration integration

The built-in Asset Pack now references:

- `skyforge-canyon-default-resource`;
- `skyforge-canyon-props-resource`;
- the `skyforge-canyon-default` 16×8 tileset definition.

Its Cardinal mapping explicitly points masks 0–15 to frames 32–47. The checked-in `.sfassetpack`, workspace lock and compiled example release were regenerated so exported collaboration artifacts match the game’s built-in resources.

## Rebuilding the atlas

Pillow is required only to regenerate the checked-in PNG files:

```bash
python -m pip install Pillow
python scripts/build-canyon-tileset.py
```

The script prints each output file and byte count. Automated tests then verify PNG dimensions, SHA-256 hashes, frame counts and Cardinal mappings.

## Collision policy

Image-backed terrain remains presentation data.

```text
Visual terrain atlas        Presentation
Logical material map        Authoritative authored visual intent
Collision corridor          Authoritative gameplay geometry
Routes and clearance        Authoritative fairness analysis
```

No atlas frame may silently create, remove or move collision.

## Current limitation and next revision

Epoch 17.4 activates Cardinal-16 and deterministic material variation. It reserves visual content for Blob-47 and dual-grid transitions but does not yet apply those algorithms automatically.

The next autotiling revision should add:

1. strict gated Blob-47 masks;
2. a true `(M+1) × (N+1)` half-tile dual grid;
3. derived visual layers and local dirty-region regeneration;
4. organic stamp/prefab selection in Level Studio;
5. rule-set stress previews in Asset Studio.
