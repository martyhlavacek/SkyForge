# Skyforge Epoch 14 Implementation

**Version:** 0.5.0  
**Date:** 2026-07-12  
**Milestone:** Asset Studio Production Workflow

## 1. Outcome

Epoch 14 turns the Game Design Studio's former asset metadata browser into a production-oriented Asset Studio. It can import and verify visual resources, classify them semantically, author runtime presentation metadata, create tilesets and deterministic atlases, preview assets in the real Phaser runtime, report broken tuning references, and export a portable `.sfassetpack`.

The implementation preserves the four-package architecture introduced in Epoch 12. Visual presentation remains in the Asset Pack; enemy, weapon, and equipment behaviour remains in the Tuning Pack; levels refer to stable asset IDs rather than file paths.

## 2. Asset ingestion and provenance

The Studio accepts PNG and WebP images. Each imported resource records:

- stable resource ID;
- filename and media type;
- byte count;
- SHA-256 hash;
- image dimensions;
- embedded base64 data for portable package exchange;
- author, licence, source, tool, import time, and notes.

Imported resources are verified before an Asset Pack becomes active. Invalid hashes, incorrect byte counts, unsupported image media, unsafe URIs, and malformed embedded resources are rejected.

Large working Asset Packs are stored in IndexedDB. A lightweight package shell remains in local storage so browser quota limits do not silently discard imported image data.

## 3. Semantic asset definitions

An asset can be classified as a player ship, enemy aircraft, ground unit, turret, building, projectile, pickup, effect, UI element, tile, overlay, weather element, shadow, or other visual role.

Definitions support:

- candidate, approved, and rejected curation states;
- role and tag lists;
- source image or built-in texture key;
- logical dimensions and scale;
- normalized pivot;
- sprite-sheet frame rectangles and frame duration;
- named animations;
- circle, rectangle, or polygon collision preview;
- hardpoints for weapons, engines, effects, and attachments;
- altitude, shadow asset, offset, scale, opacity, and softness;
- provenance and licensing through the referenced resource.

Behavioural parameters do not move into the Asset Pack.

## 4. Preview and curation workflow

The Asset workspace includes:

- searchable and filterable asset library;
- candidate/approved/rejected curation;
- neutral, canyon, ice, space, station, and combat preview environments;
- animation playback;
- visual pivot, collision, hardpoint, and shadow overlays;
- click-to-place pivot and hardpoints;
- direct editing of scale, altitude, shadow properties, and animation data;
- a real-runtime preview command using the embedded Phaser game.

The runtime bridge loads the active validated Asset Pack and renders the selected asset over the chosen environment using the same Phaser texture and animation path used by the game.

## 5. Sprite slicing and animation

The Studio can slice a uniform sprite sheet using frame width and height. Frame order is deterministic and uses stable IDs. The author can create named animations by selecting frame indices, frame rate, and looping behaviour.

The package validator rejects out-of-bounds frames and animation references to missing frames.

## 6. Collision and hardpoints

Collision authoring is presentation metadata intended for preview and future runtime binding. It supports:

- circles;
- axis-aligned rectangles;
- polygons.

Hardpoints have stable IDs, semantic kinds, local coordinates, rotation, and mirror metadata. They can represent primary or secondary weapons, engines, effects, or attachments.

Epoch 14 does not automatically overwrite existing gameplay collision definitions. Runtime adoption remains explicit and testable.

## 7. Tilesets and autotile metadata

The Asset Studio can promote an image resource into a tileset and author:

- tile size;
- columns and rows;
- margin and spacing;
- cardinal, dual-grid, or Wang-style autotile mode;
- 16 cardinal-mask mappings;
- semantic tile definitions;
- optional collision roles and animation references.

This metadata is compatible with the Level Studio's logical-material and visual-tile separation. Collision remains authoritative in Level Packages.

## 8. Deterministic atlas generation

Atlas packing uses a deterministic sorted shelf algorithm. Inputs are sorted by stable asset and frame identity, and placements produce stable frame keys. The output includes:

- atlas image resource;
- atlas dimensions;
- deterministic frame placements;
- source asset and source-frame references;
- atlas resource hash and byte count.

Automated tests verify deterministic output and non-overlap.

Atlas generation is currently browser-side and intended for authoring previews and package export. Epoch 16 will add the production compiler's dead-resource removal and final resource-copy pipeline.

## 9. Reference health and replacement

The Studio compares the active Asset Pack with enemy and equipment references in the Tuning Pack. It reports:

- missing referenced assets;
- candidate assets used by production content;
- rejected assets still referenced;
- unused assets.

A replacement operation creates a new Tuning Pack value rather than mutating the source object in place. The replacement can then be reviewed and exported through the Tuning workspace.

## 10. Built-in test resources

Epoch 14 includes a small checked-in demo set:

- four-frame fighter sheet;
- fighter shadow;
- the original miniature canyon tileset demonstration (superseded in Epoch 17.4 by the normalized default canyon terrain and props atlases).

Their dimensions, byte counts, and SHA-256 values were tested against the checked-in PNG files. The fighter resources remain workflow demonstrations; the current canyon resources are documented in `EPOCH_17_4_DEFAULT_CANYON_TILESET.md`.

## 11. Principal files

```text
src/studio/assets/AssetResourceTools.ts
src/studio/assets/AssetAtlasPacker.ts
src/studio/assets/AssetPackageStorage.ts
src/studio/assets/AssetPreviewCanvas.tsx
src/studio/assets/AssetReplacementReport.ts
src/studio/assets/AssetStudioWorkspace.tsx
src/studio/assets/AssetStudioTools.test.ts
src/game/systems/StudioAssetOverlay.ts
public/assets/studio/demo_fighter_sheet.png
public/assets/studio/demo_fighter_shadow.png
public/assets/terrain/skyforge_canyon_terrain.png
public/assets/terrain/skyforge_canyon_props.png
```

Updated integration files include:

```text
src/schemas/studioPackageSchema.ts
src/studio/BuiltInPackages.ts
src/studio/StudioApp.tsx
src/studio/ContentCompiler.ts
src/studio/PackageValidation.ts
src/studio/WorkspaceStore.ts
src/game/scenes/GameScene.ts
src/main.ts
src/studio/studio.css
e2e/smoke.spec.ts
```

## 12. Data and security boundaries

- Asset Packs remain data-only.
- Only PNG and WebP image import is accepted in this epoch.
- Embedded resources are hash and byte-count verified.
- Unsafe executable URI schemes remain blocked.
- Imported content cannot execute JavaScript, HTML, WebAssembly, shaders, or plug-ins.
- Browser object URLs are revoked after use where applicable.
- Canonical Tuning Pack data is not mutated by reference replacement previews.

## 13. Known limitations

1. Polygon collision points are currently entered as metadata rather than drawn with a full vector tool.
2. Atlas packing is a deterministic shelf implementation rather than an optimal bin packer.
3. Portable JSON envelopes remain supported; Epoch 16 added unpacked Git resource folders and content-addressed production resource output. Optional ZIP convenience transport remains future work.
4. Runtime preview is a curation surface, not yet a complete replacement of placeholder game rendering.
5. WebP decoding depends on browser support.
6. Final art, animation timing, collision adoption, and device-level visual QA remain content-production tasks.
7. The main Phaser bundle remains large and still requires production code splitting.

## 14. Recommended author workflow

1. Open `studio.html` and select **Assets**.
2. Import PNG or WebP files and enter accurate provenance and licence information.
3. Classify each visual asset and leave it as `candidate` while reviewing it.
4. Slice sprite sheets and create animations.
5. Set pivot, collision preview, hardpoints, altitude, and shadow presentation.
6. Preview against multiple environments and in the embedded runtime.
7. Approve or reject the candidate.
8. Create tileset metadata where applicable.
9. Generate an atlas and inspect deterministic frame placements.
10. Open **References**, resolve missing or rejected tuning references, and review resulting tuning changes.
11. Export `.sfassetpack` and commit or share it with the required Tuning and Level Packs.

## 15. Epoch 14 release gate

Epoch 14 is complete when:

- imported PNG/WebP resources round-trip through `.sfassetpack` export;
- embedded resource hashes and byte counts are verified;
- sprite slicing and animation references validate;
- pivot, collision, hardpoints, altitude, and shadow metadata persist;
- tileset and autotile metadata validate;
- atlas placement is deterministic and non-overlapping;
- runtime preview uses the shared Phaser runtime;
- missing/rejected tuning references are reported;
- large working packs persist through IndexedDB;
- all existing game, Studio, package, content, terrain, simulation, music, economy, and lifecycle tests remain green.
