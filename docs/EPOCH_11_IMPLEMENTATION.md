# Skyforge Epoch 11 Implementation

## Solid Terrain Runtime and Level Composer Expansion

**Implementation date:** 2026-07-12  
**Status:** Complete vertical-slice milestone; external device QA remains required

---

## 1. Summary

Epoch 11 converts terrain from decorative scrolling graphics into authored gameplay geometry and expands the React editor into a combined spatial and timeline Level Composer.

The milestone implements:

- Level Package v2 schemas and registry loading;
- a 32-pixel authoring grid over a 544-pixel internal map width;
- chunked multi-layer parallax rendering;
- authoritative corridor collision independent from artwork;
- swept player and projectile collision;
- route-clearance, navigation-hull, reaction-time, and combat-pressure analysis;
- stateful gates and destructible barriers;
- checkpoint and timeline reconstruction of terrain state;
- cardinal and first-pass dual-grid autotiling;
- a spatial Composer with painting, erase/fill, layer controls, collision/route/object editing, undo/redo, validation, preview, and package import/export;
- a playable canyon terrain slice integrated into `level_01`.

The implementation preserves the Epoch 10 campaign, equipment, currency, settlement, and adaptive-music loop.

---

## 2. Level Package v2

A terrain-enabled level references a package manifest from its ordinary timeline definition:

```json
{
  "formatVersion": "1.0",
  "id": "level_01",
  "levelPackage": "level_01_canyon"
}
```

The manifest references independently validated data domains:

```text
src/content/levelPackages/level_01_canyon.json
src/content/maps/canyon_passage.json
src/content/collision/canyon_passage_collision.json
src/content/routes/canyon_passage_routes.json
src/content/terrainObjects/canyon_passage_objects.json
src/content/biomes/canyon.json
src/content/levels/level_01.json
```

This separation is deliberate:

- `level.json` owns choreography and time;
- `map.json` owns visual layers and logical cells;
- `collision.json` owns the authoritative flight corridor;
- `routes.json` owns designer-authored safe-route intent;
- `terrainObjects.json` owns gates and destructible barriers;
- `biome.json` owns reusable material and presentation definitions;
- the package manifest joins the files without duplicating them.

Visual tiles cannot silently change collision geometry.

---

## 3. Coordinate and layer model

### 3.1 Grid

```text
Tile size:             32 × 32 px
Internal map width:   544 px
Columns:               17
Visible game width:   540 px
Runtime crop:           2 px on each side
Chunk height:          16 rows / 512 px
```

The 544-pixel authoring width provides an integer tile grid while preserving the established 540-pixel visible playfield.

### 3.2 Semantic layers

The terrain schema supports:

- `deepBackdrop`;
- `farGround`;
- `groundBase`;
- `terrainSurface`;
- `terrainDetail`;
- `airOccluder`;
- `weather`.

Collision-aligned layers must use `scrollRatio: 1`. Distant and atmospheric layers may use independent ratios.

The canyon slice includes:

| Layer               | Ratio | Purpose                               |
| ------------------- | ----: | ------------------------------------- |
| River Backdrop      |  0.42 | Slow distant riverbed                 |
| Solid Cliff Surface |  1.00 | Collision-aligned terrain             |
| Cliff Edge Detail   |  1.00 | Autotile-generated boundary treatment |
| Dust Overlay        |  1.28 | Faster atmospheric foreground         |

---

## 4. Runtime terrain

### 4.1 `TerrainRuntime`

`TerrainRuntime` owns:

- lazy creation of visible layer chunks;
- chunk disposal outside the active/prefetch range;
- material rendering;
- deterministic animated-material accents;
- weather-layer modulation;
- player corridor collision;
- projectile/terrain interaction;
- dynamic object rendering and collision;
- terrain state snapshots;
- cleanup on scene shutdown.

No map-rendering or terrain-analysis algorithm was added directly to `GameScene`. `GameScene` coordinates the service and forwards timeline/checkpoint state.

### 4.2 Collision policy

The campaign policy remains damage plus separation:

- collision geometry is authoritative;
- the player uses the loadout-derived navigation radius;
- contact damages shields/armor through the existing defense system;
- standard invulnerability prevents frame-by-frame repeated damage;
- the craft is separated from the invalid position;
- lethal terrain remains data-configurable;
- player and enemy projectile blocking are independently declared.

### 4.3 Swept collision

Player and projectile trajectories are tested over the complete frame movement rather than only at the final position.

Pure helpers cover:

- narrowing-corridor sweeps;
- moving-circle versus rectangle sweeps;
- deterministic first-impact time.

This prevents tunnelling through canyon edges, thin gates, or barriers under high-speed loadouts and development time scaling.

### 4.4 Dynamic terrain

The first object types are:

- **Gate:** timeline-controlled `open`/`closed` state with a configurable opening width;
- **Barrier:** projectile-damageable object with hit points and a credit reward.

Terrain events are part of `LevelTimeline`:

```json
{
  "at": 46,
  "type": "terrainState",
  "target": "canyon_gate_alpha",
  "state": "open"
}
```

Seeking reconstructs all prior terrain-state events. Checkpoint snapshots preserve gate and barrier state, and retries restore the captured state.

---

## 5. Route and fairness analysis

`TerrainAnalysis` is Phaser-independent and shared by tests and the Composer.

It evaluates:

- minimum corridor width;
- minimum route clearance;
- the largest approved navigation hull;
- lateral route shifts versus scroll time and movement speed;
- minimum reaction time;
- high-difficulty encounters placed inside narrow terrain.

Errors block package export. Warnings remain visible to designers.

The Composer draws the route centerline and a translucent navigation-hull envelope over the map.

---

## 6. Autotiling foundation

Terrain cells may carry a deterministic four-bit N/E/S/W `variant`.

Epoch 11 implements:

- cardinal adjacency masks;
- exposed-edge descriptors;
- variant assignment for occupied cells;
- first-pass dual-grid boundary-overlay generation;
- renderer support for directional edge strips;
- Composer regeneration after autotile painting;
- canyon cliff-detail content generated from the solid surface layer.

This is the intended foundation for both natural boundaries and later industrial Wang-tile sets. Blob-47, rotated atlas sprites, and advanced transition libraries remain future extensions.

---

## 7. Level Composer

Open:

```text
http://localhost:5173/editor.html
```

### 7.1 Workspaces

- **Spatial:** map layers, materials, collision, routes, objects, and analysis;
- **Timeline:** encounters, recovery windows, checkpoints, and terrain-state events;
- **Preview:** embedded game using unsaved project data without mutating the canonical registry.

### 7.2 Spatial modes

- Paint
- Autotile
- Collision
- Routes
- Objects
- Analysis

### 7.3 Editing features

- 17-column canvas viewport;
- vertical row navigation;
- viewport zoom;
- paint and erase through material zero;
- fill visible viewport;
- layer selection;
- visibility toggle;
- editor lock;
- solo preview;
- depth/order movement;
- collision-boundary dragging;
- route-center dragging;
- dynamic-object repositioning;
- largest-hull envelope preview;
- combined route/combat warnings;
- immutable snapshot undo/redo;
- per-level autosave.

### 7.4 Stable identities

Timeline events now use editor-only stable UUIDs. Sorting, insertion, deletion, selection, and undo no longer depend on array indexes. Editor IDs are stripped from exported runtime JSON.

### 7.5 Package import/export

**Export Package** downloads all project documents. Export is blocked when structural, cross-reference, collision, or route errors exist.

**Import Package** accepts multiple JSON files and reconstructs the project without modifying `ContentRegistry`. Missing or unrecognized files produce validation errors.

After export, place files in their corresponding `src/content/` directories before committing them.

---

## 8. Canyon vertical slice

`level_01` is now **Canyon Approach** and references `level_01_canyon`.

The authored terrain segment demonstrates:

- slow riverbed parallax;
- collision-aligned canyon cliffs;
- generated cliff-edge variants;
- animated river material accents;
- overhead dust;
- a timed gate;
- a destructible credit-bearing barrier;
- combat encounters within changing corridor widths;
- checkpoint-safe terrain state;
- projectile impact against walls and objects.

The terrain package is a vertical-slice segment, not final art. It uses procedural colour materials until the production atlas pipeline is introduced.

---

## 9. Automated coverage

Epoch 11 adds tests for:

- terrain schemas and registry cross-references;
- corridor interpolation and separation;
- swept corridor and rectangle collision;
- route clearance and reaction-time analysis;
- combined terrain/combat pressure;
- cardinal and boundary-overlay autotiling;
- timeline terrain event firing and seek reconstruction;
- checkpoint terrain state capture and rollback;
- editor history;
- Level Package v2 export/import round trips;
- incomplete-package rejection.

The Playwright suite now includes a terrain gate timeline test and a Composer canvas/base-path check. Browser execution still requires an unrestricted environment.

---

## 10. Testing guide

### Game

```sh
npm ci
npm run dev
```

1. Open the printed game URL.
2. Enter the Hangar and launch `Canyon Approach`.
3. Fly against canyon walls and confirm one damage episode plus separation.
4. Confirm bullets stop at cliffs.
5. At approximately 46 seconds, confirm the gate opens.
6. At approximately 65 seconds, confirm it closes.
7. Shoot the orange barrier until destroyed and confirm the reward.
8. Retry from a checkpoint and confirm terrain state is reconstructed.
9. Test a fast propulsion/loadout combination for tunnelling.

Development controls may be used to accelerate the run, but final feel testing should use normal time.

### Composer

1. Open `/editor.html`.
2. Select `Canyon Approach`.
3. Toggle, lock, solo, and reorder layers.
4. Paint and erase cells; use Undo/Redo.
5. Use Autotile on the cliff surface and inspect generated edge variants.
6. Drag collision boundaries and route points.
7. Confirm impossible clearance blocks export.
8. Move the gate or barrier in Objects mode.
9. Add a terrain-state timeline event.
10. Preview unsaved changes.
11. Export the package, then re-import all exported files together.

---

## 11. Known limitations and deferred production work

- Placeholder procedural materials are used instead of final texture atlases.
- The authoritative canyon collision representation is an interpolated corridor; arbitrary polygon and edge-chain obstacles are the next collision format extension.
- Object mode repositions existing gates/barriers but does not yet contain full creation/deletion property forms.
- Autotiling is the cardinal/dual-grid foundation, not a complete Blob-47 or industrial atlas library.
- The current canyon terrain package covers the designed vertical-slice segment; later level time returns to an open playfield.
- Animated materials use deterministic procedural accents rather than authored frame atlases.
- Recorded input heatmaps, collaborative editing, and procedural route-first generation remain deferred.
- Physical iPhone, controller, Firefox, and Safari verification must be performed externally.

---

## 12. Recommended Epoch 12

Epoch 12 should be **Asset Pipeline and Composer Production Hardening**:

1. texture atlas and tileset manifests;
2. imported pixel-art tiles replacing procedural materials;
3. polygon and edge-chain collision tools;
4. full gate/barrier object inspectors and creation tools;
5. deterministic frame-based animated tiles;
6. industrial Wang rules and expanded natural transition sets;
7. map cursor/checkpoint preview launching;
8. telemetry heatmap import;
9. route-first seeded draft generation;
10. physical mobile/controller performance and usability QA.

This sequence builds on the validated terrain data model rather than replacing it.
