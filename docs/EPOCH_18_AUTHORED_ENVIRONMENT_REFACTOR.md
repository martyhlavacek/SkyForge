# Epoch 18 Authored Environment Refactor

## Purpose

Epoch 18 closes the visual gap identified against *Raptor: Call of the Shadows*, *Tyrian*, and *Major Stryker*. The prior Blob-47 implementation proved topology, but the water, sandstone, shoreline, and map shapes still exposed procedural repetition. This release keeps the visual-only terrain model and changes how the environment is constructed and rendered.

## Rendering architecture

### Continuous water

The canyon uses one world-aligned `tileSprite` layer with no explicit river cells. The runtime loads a three-frame 768×256 water sheet as 256×256 frames, advances it at 0.8 frames per second, and applies only subtle drift. Each frame wraps exactly on both axes and has balanced horizontal/vertical gradient energy so one diagonal direction no longer dominates the playfield.

### Continuous sandstone through Blob-47 masks

The land interior is no longer drawn from repeated 32-pixel texture tiles. A standalone seamless 256×256 sandstone source is tiled into each visible terrain chunk. The runtime then applies the chunk's Blob-47 cell frames as an alpha mask using a Phaser `CanvasTexture` and `destination-in` compositing. Chunk height is 512 pixels, an exact multiple of the source texture, so texture phase remains continuous between chunks.

The visual stack is:

1. continuous animated water plane;
2. continuous sandstone source composited through Blob-47 occupancy;
3. transparent shoreline lip and undercut frames;
4. sediment, rocks, cracks, scrub, ruins, and platform details;
5. aircraft shadows and gameplay objects.

### Shoreline simplification

All 47 canonical shoreline frames were rebuilt as thin transparent overlays. The core transition set contains a restrained light rock lip and continuous dark undercut. Repeated cave-like cavities are no longer part of ordinary shoreline topology; cave and ruin forms belong to independent set-dressing assets.

## Geological map construction

The canyon generator now treats macro-shape and surface detail as separate stages.

1. Authored control points define broad bends, pinches, basins, and set-piece zones.
2. Substantial islands and peninsulas are added as large forms.
3. Deterministic cleanup fills tiny holes, removes isolated cells and one-cell spurs, widens fragile connections, and removes undersized components.
4. Blob-47 variants are calculated only after cleanup.
5. Independent environment details are placed according to surface and shoreline suitability.

The current map contains four interior islands with component areas of 63, 77, 82, and 116 cells. The opening is intentionally readable rather than a dense mask stress test.

## Set dressing

The generated level includes separate sparse layers:

| Layer | Cells |
|---|---:|
| Sediment | 102 |
| Rock clusters | 128 |
| Cracks | 122 |
| Scrub | 56 |
| Landmarks / ruins / platforms | 38 |

These layers are independent of Blob-47 topology, which prevents decorative motifs from repeating at every shoreline cell. Placement is deterministic so source regeneration and QA remain reproducible.

## Player shadow

The player shadow was redrawn as three nested ship-shaped silhouettes rather than an angular slash or generic ellipse. It uses a closer +10/+14 pixel offset, wider horizontal scale, 0.64 vertical scale, and 0.34 base opacity. It remains below the player, follows movement and visibility, participates in damage blinking, and is destroyed with the player object.

## Content representation

Canyon Passage now contains 8,183 explicit cells:

- 5,935 sandstone topology cells;
- 1,802 shoreline cells;
- 446 environmental detail cells;
- zero explicit water cells.

The checked-in map JSON is 867,728 bytes. Runtime source assets are a 55,439-byte mask/decor atlas, 51,210-byte water sheet, 79,509-byte sandstone source, and 131,877-byte props atlas.

## Compatibility

- Terrain remains visual-only: no player contact damage, clamping, or projectile blocking.
- The map schema retains ordinary cell rendering and adds `compositedCells` for continuous-source terrain.
- Existing Cardinal-16 and Blob-47 frame fields remain supported.
- The Studio package model now includes the sandstone source as a locked production resource.
