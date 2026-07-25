# Epoch 17.9 — Continuous Terrain Refactor

**Release:** 0.9.1  
**Date:** 2026-07-14

## Purpose

Epoch 17.9 corrects the remaining visible tile repetition in the Canyon Passage presentation. The terrain remains decorative and non-colliding, but water, sandstone fill, shoreline topology, the demonstration map, and the player shadow now use separate rendering responsibilities.

## Rendering architecture

### Continuous water plane

The former `river_base` layer stored 13,600 individual 32×32 cells. It has been replaced by one world-aligned Phaser `TileSprite` layer named `river_plane`.

- Two seamless 128×128 water frames are stored in `skyforge_canyon_water.png`.
- All water uses one synchronized animation phase.
- Texture coordinates drift through world space instead of restarting in every map cell.
- The water plane covers the full playfield and scrolls at the same world ratio as the terrain.
- The level map contains no explicit water cells.

### Sandstone interior

The land interior no longer repeats a cliff-face stamp in every occupied cell.

- A coordinated 128×128 sandstone metatile is divided into sixteen 32×32 atlas frames.
- Interior cells select their frame from their position in the 4×4 metatile grid.
- Large-scale color and erosion features therefore cross individual cell boundaries.
- Interior cells contain no shoreline treatment.

### Blob-47 boundary and shoreline

Blob-47 is now confined to the terrain boundary where it is useful.

- `sandstone_boundary` contains the 47 canonical eight-neighbour shapes.
- `shoreline` reuses the exact same masks as a transparent lip/undercut overlay.
- Unsupported diagonal bits are normalized away unless both adjacent cardinal neighbours exist.
- Fully surrounded cells are rendered by the sandstone interior layer rather than a boundary tile.

This separates topology from surface texture: Blob-47 defines the bank, while the metatile defines the land field.

## Canyon demonstration map

The opening section deliberately exercises the connected-terrain system rather than presenting long parallel walls. It includes:

- asymmetric curves and S-bends;
- widening and narrowing channels;
- concave bays and convex projections;
- narrow peninsulas;
- multiple small and medium islands;
- shoreline transitions on both banks and island perimeters.

The map continues to cover the complete mission scroll distance. Terrain collision, contact damage, projectile blocking, gates, and barriers remain disabled.

## Player ship shadow

The player now uses a dedicated generated shadow texture rather than a faint generic ellipse.

- offset: 14 px right and 18 px down;
- scale: 0.92 horizontal and 0.48 vertical;
- opacity: 0.42;
- depth: immediately below the player and above terrain;
- follows player movement, visibility, invulnerability blinking, death, and destruction.

## Data reduction

| Measure | Epoch 17.8 | Epoch 17.9 | Change |
|---|---:|---:|---:|
| Explicit water cells | 13,600 | 0 | −100% |
| Total explicit terrain cells | 21,343 | 8,047 | −13,296 / 62.3% |
| Canyon map JSON | 1,935,711 B | 751,546 B | −1,184,165 B / 61.2% |

## Files central to the change

- `src/game/terrain/TerrainRuntime.ts`
- `src/game/terrain/TerrainTileset.ts`
- `src/game/terrain/Autotile.ts`
- `src/schemas/terrainSchema.ts`
- `src/game/entities/Player.ts`
- `src/game/scenes/PreloadScene.ts`
- `scripts/build-canyon-level.py`
- `scripts/build-canyon-tileset.py`
- `scripts/verify-canyon-textures.py`
- `scripts/render-canyon-preview.py`
- `src/content/maps/canyon_passage.json`
- `src/content/biomes/canyon.json`

## Actual rendered preview

`EPOCH_17_9_CANYON_PREVIEW.png` is generated directly from the checked-in map and final runtime atlases. It is not a separate concept image.
