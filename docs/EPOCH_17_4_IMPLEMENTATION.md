# Epoch 17.4 Implementation Report

## Release objective

Import the generated canyon source sheet as a default, game-visible tileset without depending on the AI Asset Foundry at runtime.

## Implemented

- Added a reproducible Pillow normalization pipeline and retained source master.
- Generated a strict 128-frame terrain atlas and 64-frame props atlas.
- Added a machine-readable atlas manifest with SHA-256 hashes and semantic frame ranges.
- Extended the Biome schema with validated image-backed runtime tileset metadata.
- Added frame-bound checks, relative-URI safety and complete Cardinal-16 mapping validation.
- Added shared deterministic frame resolution for editor and runtime.
- Added Phaser spritesheet preloading for registered biome tilesets.
- Replaced procedural-only terrain chunks with image-backed chunk containers while preserving procedural fallback.
- Added animated river and foam frame updates.
- Added Level Studio atlas drawing and real material thumbnails.
- Added a metal-platform material and visible demonstration layer to Canyon Passage.
- Registered terrain and props resources in the built-in Asset Pack.
- Regenerated the example Asset Pack, workspace dependency lock and compiled release example.
- Added unit, schema, PNG/hash and React canvas integration tests.
- Added a Playwright scenario for atlas loading and palette visibility.

## Important design decision

Logical map cells remain independent from atlas coordinates. This allows the art to be replaced or expanded without rewriting levels and preserves collision as an independent authoritative system.

## Deferred

- Automatic Blob-47 mapping.
- True dual-grid half-tile rendering.
- Props/stamp palette in Level Studio.
- Directional lighting correction for rotated dual-grid primitives.
- Final production-art review and hand cleanup of every mask.
