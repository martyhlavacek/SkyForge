# Skyforge

## Tile Asset Pipeline and Level Composer Integration Addendum

**Status:** Governing design; Epoch 11 foundation and Epoch 17.4 image-backed default tileset implemented  
**Applies to:** Level Composer, tile asset pipeline, terrain runtime, collision authoring, biome packages, parallax rendering, animated and destructible terrain, route validation, preview, export, and automated tests  
**Source reviewed:** “Architecture and System Design of a Multi-Environment Tile Asset Pipeline for Classic Vertical-Scrolling Shoot-'Em-Ups”
**Implementation evidence:** `EPOCH_11_IMPLEMENTATION.md`

---

## 1. Executive decision

Skyforge should adopt the source document’s modern architectural ideas, but not reproduce the historical DOS storage and rendering constraints.

The following concepts are approved in principle:

1. A 32 × 32 logical terrain grid.
2. A typed multi-layer visual stack with independent scroll ratios.
3. Separation of logical terrain, visual tiles, collision geometry, routes, actors, and timeline events.
4. Chunked map storage and runtime streaming.
5. Data-driven tileset manifests.
6. Autotiling for material boundaries.
7. Animated tile definitions.
8. Destructible and stateful terrain definitions.
9. Biome presets that configure layers, materials, lighting, weather, and transition rules.
10. Strong editor validation and immediate in-game preview.

The following historical techniques are useful only as visual or design references and should not govern the modern implementation:

- EGA planar memory layouts;
- VGA byte-level tile formats;
- fixed historical map-width limits;
- manual software double buffering;
- DOS archive formats;
- hard limits on unique tiles;
- CPU-era pixel occlusion tricks;
- storing collision implicitly in artwork or palette indexes.

---

## 2. Current-state assessment

The original assessment below governed the pre-Epoch-11 prototype. The implemented system now includes:

- a 32×32 logical spatial map and typed visual layers;
- a canvas-first Level Studio with painting, erasing, selection, stroke-level undo and minimap navigation;
- independently editable collision corridors, routes and dynamic terrain objects;
- chunked terrain runtime rendering and route/fairness analysis;
- stable-ID package data, import/export, validation and runtime preview;
- an image-backed default canyon atlas shared by the editor, runtime and Asset Pack;
- deterministic Cardinal-16 cliff variants plus animated water and stable material variation.

The map continues to separate logical terrain, visual presentation, collision, routes, actors and timeline state. Automatic gated Blob-47 and true half-tile dual-grid generation remain planned; the Epoch 17.4 atlas reserves organic transition frames for that work.

---

## 3. Grid and world-width decision

### 3.1 Approved logical tile size

Use a **32 × 32 pixel logical grid**.

Reasons:

- sufficient detail for the intended pixel-art style;
- straightforward atlas packing;
- compatible with natural, industrial, and biological environments;
- efficient chunk dimensions;
- well suited to half-tile overlay transitions;
- large enough for readable editor thumbnails.

### 3.2 Resolving the current 540-pixel playfield

The current logical playfield width is 540 pixels, which is not divisible by 32.

Adopt:

```text
Map world width:       544 px
Tile columns:          17
Visible playfield:     540 px
Hidden crop margin:      2 px per side
Tile size:              32 px
```

Define these independently:

```ts
export const MAP_WORLD_WIDTH = 544;
export const PLAYFIELD_WIDTH = 540;
export const PLAYFIELD_OFFSET_X = 2;
export const TILE_SIZE = 32;
```

The camera and player bounds may continue to present a 540-pixel playfield. Map, collision, and route tools operate in the 544-pixel world. The two-pixel crop on each side is invisible and avoids fractional tiles.

Do not silently stretch tiles or use a non-square 31.7647-pixel grid.

---

## 4. Level package architecture

A level should become a package rather than one growing JSON file.

```text
levels/level_01/
├── manifest.json
├── level.json
├── map.json
├── collision.json
├── routes.json
├── actors.json
├── music.json
└── thumbnails/
    └── overview.png
```

### 4.1 `manifest.json`

Owns package identity and references:

```json
{
  "formatVersion": "2.0",
  "id": "level_01",
  "displayName": "Canyon Approach",
  "level": "level.json",
  "map": "map.json",
  "collision": "collision.json",
  "routes": "routes.json",
  "actors": "actors.json",
  "music": "music.json",
  "biomeId": "canyon_01"
}
```

### 4.2 `level.json`

Retains mission-level orchestration:

- duration target;
- base scroll speed and scroll profile;
- encounter events;
- recovery events;
- checkpoints;
- boss and gate timeline events;
- high-level music states;
- package metadata.

### 4.3 `map.json`

Owns visual tile layers, chunks, tileset references, and visual-only decorations.

### 4.4 `collision.json`

Owns authoritative solid and hazardous geometry. It must remain independent from visual tile selection.

### 4.5 `routes.json`

Owns:

- approved player-route centerlines;
- route widths;
- checkpoint spawn envelopes;
- enemy flight lanes;
- validation profiles for approved navigation hulls.

### 4.6 `actors.json`

Owns spatially placed entities:

- turrets;
- tanks;
- buildings;
- pickups;
- destructible objects;
- environmental emitters;
- trigger volumes.

Timeline events may activate actors, but actors should not be embedded inside tile data.

---

## 5. Typed layer model

Do not expose only a generic numeric parallax factor. Each layer should have a semantic role.

```ts
type MapLayerRole =
  | 'deepBackdrop'
  | 'farGround'
  | 'groundBase'
  | 'terrainSurface'
  | 'terrainDetail'
  | 'airOccluder'
  | 'weather'
  | 'editorGuide';

interface TileLayerDef {
  id: string;
  name: string;
  role: MapLayerRole;
  tilesetId: string;
  scrollRatio: number;
  zIndex: number;
  opacity: number;
  blendMode?: 'normal' | 'add' | 'multiply' | 'screen';
  visible: boolean;
  editable: boolean;
  chunks: TileChunkDef[];
}
```

### 5.1 Scroll-ratio convention

Use one clear convention:

```text
1.00 = interactive world speed
0.10 = very distant backdrop
0.35 = far terrain
1.00 = collision-aligned terrain
1.15–1.50 = overhead atmosphere or foreground vapour
```

With the current world-distance model:

```ts
screenY = worldScrollDistance * layer.scrollRatio - worldY;
```

Looping layers apply modulo wrapping after calculating layer distance.

This is less ambiguous than defining a “parallax factor” where larger values produce less movement.

### 5.2 Collision alignment rule

Any visible feature representing solid collision must use `scrollRatio: 1.0`.

A slow riverbed, cloud bank, or distant canyon floor may use a lower ratio, but the navigable cliff edge drawn above it must remain aligned with the collision world.

### 5.3 Proposed render order

```text
DEEP_BACKDROP
FAR_GROUND
GROUND_BASE
TERRAIN_SURFACE
GROUND_DECALS
GROUND_SHADOWS
GROUND_ACTORS
AIRCRAFT_SHADOWS
PLAYER_AND_ENEMIES
PROJECTILES
AIR_OCCLUDERS
WEATHER
EFFECTS
HUD
DEBUG
```

Overhead foliage, girders, clouds, or vapour should be collision-free unless an explicit separate collider is authored.

---

## 6. Chunk model and runtime rendering

Use fixed-height chunks rather than one enormous tile array.

Recommended initial values:

```text
Chunk width:   17 tiles / 544 px
Chunk height:  16 tiles / 512 px
Tile count:    272 cells per full layer chunk
Active window: visible chunks plus one prefetch chunk above and below
```

### 6.1 Source representation

During development, use row-major integer arrays in JSON because they are inspectable and easy to test.

```ts
interface TileChunkDef {
  chunkY: number;
  width: 17;
  height: 16;
  data: number[];
}
```

Do not introduce binary compression during the first implementation. Production web compression already reduces JSON effectively. Run-length encoding may be added only after profiling proves worthwhile.

### 6.2 Rendering strategy

For each active chunk:

- static tile layers may be baked into a Phaser RenderTexture;
- animated tiles remain separate runtime sprites or batched tile instances;
- stateful/destructible cells remain addressable entities;
- chunks outside the active window are recycled;
- tileset atlases are loaded once per biome package.

This provides the useful memory discipline of the historical systems without recreating their binary formats.

---

## 7. Tileset manifest

Each tileset should have a validated manifest.

```ts
interface TilesetManifest {
  formatVersion: '1.0';
  id: string;
  image: string;
  tileWidth: 32;
  tileHeight: 32;
  columns: number;
  tileCount: number;
  defaultMaterialId?: string;
  tiles: Record<string, TileMetadata>;
  animations?: Record<string, TileAnimationDef>;
  autotileRuleSets?: Record<string, AutotileRuleSetDef>;
}
```

Tile metadata may include:

```ts
interface TileMetadata {
  tags?: string[];
  animationId?: string;
  materialId?: string;
  visualHeight?: 'floor' | 'low' | 'wall' | 'overhead';
  occlusion?: 'none' | 'partial' | 'opaque';
  lightVariant?: string;
  destructibleProfileId?: string;
}
```

Tile metadata may help authoring and rendering, but it must not replace authoritative collision geometry.

---

## 8. Autotiling strategy

The source document describes Blob-47, Marching Squares, and a half-tile dual-map approach. Skyforge should use a **tiered hybrid**, not one universal algorithm.

### 8.1 Natural material boundaries

Use a dual-grid overlay system for transitions such as:

- grass to soil;
- sand to rock;
- snow to ice;
- marsh to stone;
- flesh to bone;
- floor plating to open void.

The editor stores a logical base-material grid and generates an offset transition overlay. This reduces artist workload and gives smooth transitions.

Persist the logical material grid as authoritative. Generated overlay tile IDs may be cached but must be reproducible.

### 8.2 Cliffs and solid navigation walls

Do **not** rely solely on Blob-47 to generate collision-bearing canyon walls.

Cliffs require:

- explicit collision edges;
- elevation faces;
- directional shadows;
- readable route openings;
- special gate and corner pieces;
- consistency with route validation.

Use authored edge chains/polygons for collision and an edge-decoration rule set for visuals. The Composer may suggest cliff tiles from the edge geometry, but the designer must be able to override them.

### 8.3 Industrial environments

Use Wang-style edge/corner rules or a compact 16-state cardinal system for:

- station corridors;
- metallic walls;
- platform edges;
- modular panels;
- conduits.

Industrial art usually benefits from strict cardinal alignment rather than organic Blob-47 rounding.

### 8.4 Blob-47 support

Blob-47 may be added as an advanced rule type for organic terrain after the dual-grid and industrial systems are stable.

It should not be the first autotiling milestone because it creates the greatest asset burden and does not solve collision authoring.

### 8.5 Rotation and mirroring

Rotation and mirroring may be used for neutral transition tiles. Do not rotate tiles containing directional light, text, damage marks, or baked shadows unless their manifest explicitly permits it.

---

## 9. Animated and palette-driven terrain

### 9.1 Animated tiles

Support reusable animation definitions:

```ts
interface TileAnimationDef {
  id: string;
  frames: number[];
  framesPerSecond: number;
  mode: 'loop' | 'pingPong' | 'once';
  randomStart?: boolean;
}
```

Good first uses:

- water currents;
- sand falls;
- fans;
- power conduits;
- lava;
- biological pulses;
- warning lights.

All cells using the same animation should share a clock unless intentional variation is requested.

### 9.2 Palette cycling

Palette cycling can be recreated with shaders or indexed lookup textures, but it should be optional.

Do not make 8-bit indexed rendering a core engine dependency. Use palette effects selectively for:

- heat shimmer;
- water shimmer;
- power flow;
- biological pulse;
- warning lights.

The baseline renderer remains RGBA/WebGL.

---

## 10. Destructible and stateful terrain

Destructible terrain should be represented as stateful cells or compound actors, not by permanently modifying raw tile arrays without identity.

```ts
interface StatefulTerrainDef {
  id: string;
  cellX: number;
  cellY: number;
  profileId: string;
  initialState: string;
}

interface TerrainStateProfile {
  id: string;
  states: Record<
    string,
    {
      tileId: number;
      collisionState: 'solid' | 'open' | 'hazard';
      hitPoints?: number;
      nextState?: string;
      effectId?: string;
      dropTableId?: string;
    }
  >;
}
```

Checkpoint state must capture every changed terrain-state ID.

Initial destructible use cases should be limited to:

- weak canyon barricade;
- blast door;
- breakable station wall;
- biological membrane;
- destructible turret platform.

Avoid large-scale arbitrary tile destruction until save, replay, and checkpoint reconstruction are proven.

---

## 11. Biome packages

A biome package should configure authoring defaults rather than hard-code behavior into the editor.

```ts
interface BiomeDefinition {
  id: string;
  displayName: string;
  tilesets: string[];
  defaultLayers: LayerPreset[];
  materials: string[];
  autotileRuleSets: string[];
  weatherPresets: string[];
  lightingProfileId: string;
  audioProfileId?: string;
}
```

Recommended first biome packages:

1. **Canyon** — cliffs, riverbed, dust, gates, rock hazards.
2. **Space station** — modular corridors, void, girders, fans, energy barriers.
3. **Ice world** — ice shelves, rifts, snow, blizzard overlays, crystal hazards.

Desert, jungle, gas giant, and biological interiors should follow once the pipeline has proven it can express the first three without special-case code.

### 11.1 Environmental force zones

The uploaded proposal suggests friction changes on ice. For an airborne shooter, use explicit force zones instead of conventional ground friction:

- crosswind;
- turbulence;
- magnetic pull;
- spore gust;
- gas-current drift;
- gravity or tractor field.

These must be visible, data-driven, and authorable as trigger/volume objects.

---

## 12. Level Composer user interface

The current two-column timeline UI should evolve into a multi-pane Level Composer.

```text
┌────────────────────────────────────────────────────────────────────┐
│ Toolbar: package | biome | mode | undo | redo | validate | preview │
├──────────────┬──────────────────────────────────┬──────────────────┤
│ Layer tree   │                                  │ Inspector        │
│ Tilesets     │          Map viewport            │ Properties       │
│ Palette      │       collision/route overlay    │ Validation       │
│ Brushes      │                                  │ Analysis         │
├──────────────┴──────────────────────────────────┴──────────────────┤
│ Timeline / intensity / scroll speed / music / gates / checkpoints │
└────────────────────────────────────────────────────────────────────┘
```

### 12.1 Editor modes

- **Paint:** place and erase logical material cells or explicit tiles.
- **Autotile:** paint materials and regenerate transitions.
- **Collision:** draw rectangles, polygons, edge chains, hazards, and gates.
- **Objects:** place actors, pickups, turrets, emitters, and triggers.
- **Routes:** draw and validate player and enemy routes.
- **Timeline:** author encounters, gates, music, recovery, and checkpoints.
- **Preview:** run from cursor, checkpoint, event, or world position.
- **Analysis:** show clearance, reaction time, combat pressure, and collision heatmaps.

### 12.2 Layer tree

The layer panel should support:

- visibility;
- lock/unlock;
- opacity;
- z-order;
- scroll-ratio display;
- active-edit layer;
- solo mode;
- collision alignment warning;
- biome preset restoration.

### 12.3 Canvas technology

Use Phaser or another WebGL/canvas renderer inside the React editor for the map viewport. Do not implement thousands of tiles as individual DOM elements.

React should own application state and panels. The canvas owns pan, zoom, painting, overlays, selection, and high-frequency pointer interaction.

---

## 13. Editor state and undo/redo prerequisite

Before map painting begins, introduce a normalized project state:

```ts
interface EditorProject {
  manifest: LevelManifest;
  level: LevelDefV2;
  map: MapDef;
  collision: CollisionDef;
  routes: RouteSetDef;
  actors: ActorPlacementDef;
  dirtyFiles: Set<string>;
}
```

All editable entities must have stable IDs.

Use command-based history:

```ts
interface EditorCommand {
  label: string;
  apply(project: EditorProject): EditorProject;
  revert(project: EditorProject): EditorProject;
}
```

Commands should include:

- paint stroke;
- fill region;
- move object;
- add/delete collider;
- edit polygon point;
- change tile layer;
- change event time;
- regenerate autotile region;
- paste selection.

A paint drag should become one undoable command, not hundreds of history entries.

---

## 14. Validation

Export must be blocked for structural errors.

### 14.1 Map validation

- all referenced tilesets exist;
- tile IDs are in range;
- chunks have correct dimensions;
- duplicate layer IDs are rejected;
- collision-aligned layers use a 1.0 scroll ratio;
- map length and mission duration are compatible;
- no invalid transform is applied to a directional tile;
- animation frame IDs exist;
- stateful terrain profiles exist.

### 14.2 Collision and route validation

Continue the approved solid-terrain requirements:

- continuous route exists;
- approved ship envelopes fit;
- checkpoints do not spawn inside expanded collision;
- gate timing permits escape;
- precision narrowing provides adequate reaction time;
- collision geometry matches package bounds;
- colliders and visual terrain remain within alignment tolerance.

### 14.3 Timeline integration validation

- a timed gate references an existing gate object;
- a destructible-state event references an existing terrain-state ID;
- scroll transitions do not create impossible upcoming turns;
- enemy formations assigned to constrained corridors use terrain-compatible routes;
- music, weather, and visual-transition events reference valid assets.

### 14.4 Readability warnings

Warnings should identify:

- foreground occluder covering the player for too long;
- collision edge with insufficient visual contrast;
- projectile colour too close to terrain palette;
- high-pressure encounter inside a narrow route;
- weather opacity exceeding a safe threshold;
- large aircraft-shadow offset crossing a solid wall unrealistically.

---

## 15. Preview and analysis

The preview system should allow:

- play from current map cursor;
- play from selected timeline event;
- play from checkpoint;
- use a selected ship/loadout envelope;
- toggle collision geometry;
- toggle generated autotile overlays;
- solo individual visual layers;
- freeze or scrub world scroll;
- inspect active chunks;
- record collision and route heatmaps.

The preview must use a temporary content provider and must not mutate the canonical runtime registry.

---

## 16. Performance policy

Adopt modern performance practices rather than historical pixel-level optimization.

Use:

- texture atlases;
- chunk culling;
- pooled chunk render objects;
- static RenderTextures for immutable layers;
- batched animated tiles;
- spatial indexing for collision and actors;
- lazy biome loading;
- separate quality profiles for weather and foreground effects.

Defer unless profiling proves necessary:

- explicit deep-layer pixel occlusion maps;
- custom binary map files;
- indexed-colour-only rendering;
- WebAssembly tile decoding;
- per-pixel collision;
- arbitrary real-time tile deformation.

---

## 17. Recommended Epoch 11 sequence

### Epoch 11.0 — Composer foundation refactor

- stable editor entity IDs;
- normalized `EditorProject` state;
- command-based undo/redo;
- Level Package v2 schemas and migration;
- 544-pixel map-world constants;
- package import/export.

### Epoch 11.1 — Tile runtime and map viewport

- tileset manifest and validation;
- chunk schema and streaming runtime;
- typed visual layers;
- React + canvas editor shell;
- pan, zoom, grid, selection;
- paint/erase/fill;
- layer tree;
- root/base-path loading tests.

### Epoch 11.2 — Collision and route authoring

- rectangle, polygon, and edge-chain tools;
- collision materials;
- player navigation-hull overlay;
- route centerline authoring;
- clearance and reaction-time validation;
- swept runtime collision;
- checkpoint and gate state.

### Epoch 11.3 — Autotiling and biome system

- logical material grid;
- dual-grid transition overlay;
- industrial edge/Wang rules;
- biome manifests and presets;
- tile transform restrictions;
- partial-region regeneration;
- visual/collision alignment checks.

### Epoch 11.4 — Dynamic terrain and atmospheric layers

- animated tile clock;
- stateful/destructible terrain;
- weather and overhead layers;
- force zones;
- material-specific impact effects;
- checkpoint and seek reconstruction.

### Epoch 11.5 — Timeline and analysis integration

- gate events;
- terrain-state events;
- weather and layer events;
- combined combat/route intensity view;
- heatmaps and telemetry import;
- play-from-cursor and play-from-event.

### Epoch 11.6 — First complete terrain slice

Build one canyon level containing:

- slow riverbed backdrop;
- collision-aligned canyon walls;
- dual-grid floor transitions;
- one animated water/current family;
- one destructible barricade;
- one timed gate;
- one overhead dust layer;
- one terrain-aware encounter sequence;
- checkpoint and recovery section;
- keyboard, gamepad, and iPhone QA.

---

## 18. Acceptance criteria

The tile pipeline and Composer milestone is complete only when:

1. The map uses a 32-pixel grid with a documented 544-pixel world width.
2. Level content is exported as a validated multi-file package.
3. Logical material, visual tile, collision, route, actor, and timeline data are separate.
4. Visual layers have semantic roles and unambiguous scroll ratios.
5. Collision-representing visuals remain aligned at world scroll ratio 1.0.
6. Static chunks stream and recycle without visible seams.
7. The editor paints and erases tiles with undo/redo.
8. The editor supports layer visibility, locking, ordering, and soloing.
9. A natural material transition can be generated with dual-grid autotiling.
10. An industrial transition set can use cardinal/Wang rules.
11. Cliff collision remains authoritative and independently editable.
12. Animated tiles share deterministic clocks and survive pause/seek.
13. Stateful terrain is checkpoint-safe and replayable.
14. Approved navigation hulls have continuous validated routes.
15. Timeline gates and terrain-state events reference valid spatial objects.
16. The preview can launch from cursor, event, and checkpoint.
17. Map export is blocked for invalid tile IDs, package references, collision, or impossible routes.
18. The system maintains target performance on desktop and an acceptable mobile profile.
19. The first canyon slice demonstrates parallax, collision, autotiling, animation, destruction, gates, and combat together.
20. No map-rendering, autotiling, polygon-editing, or route-analysis algorithm is added directly to `GameScene`.

---

## 19. Recommendation

The uploaded architecture should inform Skyforge’s **content model and authoring workflow**, not its low-level DOS implementation.

The most valuable pattern is a four-way separation:

```text
LOGICAL MATERIAL GRID
        ↓
GENERATED / AUTHORED VISUAL TILES
        ↓
INDEPENDENT COLLISION AND ROUTES
        ↓
TIMELINE, ACTORS, AND DYNAMIC STATE
```

This structure will let Skyforge support canyon, desert, jungle, ice, gas-giant, station, and biological environments without coupling every biome to engine code. It also preserves the solid-terrain fairness requirements already approved for Epoch 11.

---

## Game Design Studio asset-package boundary

Epoch 12 introduces `.sfassetpack` as the semantic visual-content boundary shared by the Asset Studio and Level Studio.

An Asset Pack defines stable asset IDs, semantic kinds and roles, resource references, dimensions, pivots, collision previews, animations, altitude, shadows, tilesets, autotile rules, provenance, and licensing. Enemy behaviour remains in `.sftuning`; level placement remains in `.sflevelpack`.

The Epoch 12 Asset workspace provides a semantic browser and editable altitude/shadow preview for current placeholder assets. Production image import, slicing, animation authoring, hardpoints, atlas packing, advanced tilesets, and portable resource hashing are assigned to Epoch 14.

## 20. Epoch 16 production packaging and release compilation

Asset and Level Packs now support a Git-friendly folder representation with one stable-ID JSON file per authored item, explicit authored-order indexes, and ordinary binary resource files. This allows collaborators to review tile definitions, autotile rules, maps, collision, routes, and visual resources without merging a monolithic JSON envelope.

The production compiler treats authoring atlases as approved inputs. It verifies and copies only resources referenced by the selected package set, assigns content-addressed output paths, and reports unreferenced resources. It deliberately does not introduce a second atlas-packing algorithm at release time; atlas layout and pixel composition remain Asset Studio responsibilities so preview and shipped results cannot diverge.

A dependency lock pins the exact Asset, Level, Music, and Tuning Pack fingerprints used by the workspace. A changed tileset, collision package, atlas, or visual resource therefore produces lock drift and requires an explicit review and lock refresh before release.

Blocking review comments may target a package or JSON path. Appropriate release blockers include missing licence metadata, invalid collision/visual alignment, unresolved route clearance, incomplete atlas approval, and placeholder assets that must not ship.

## AI-generated tileset workflow

The AI Asset Foundry may generate terrain concepts or tile-family source studies, but Level Studio collision remains authoritative. A terrain generation brief must define tile size, material family, required edge/corner states, lighting, palette and destruction/animation variants. Generated source sheets are processed and sliced in Asset Studio, assigned autotile mappings, tested in a repeated map sample, approved, then referenced by the Level Pack through stable tileset IDs.

No generated visual tile may silently create, remove or move solid collision. Route validation must be rerun after every visual tileset assignment to confirm readability even when geometry is unchanged.

## 21. Epoch 17.4 implemented image-backed canyon pipeline

Epoch 17.4 operationalizes the generated canyon source study without requiring the Foundry at runtime. `scripts/build-canyon-tileset.py` reconstructs selected source cells into a strict 16×8 terrain atlas and 16×4 props atlas. The build is reproducible and checked by byte/hash tests.

The Canyon biome declares validated visual mappings for base variation, animated water, foam, Cardinal-16 cliffs, cliff-edge stamps and metal platforms. The shared `TerrainTileset` resolver selects frames identically in the Level Studio and Phaser runtime. Missing assets retain the procedural fallback.

The authoritative relationship is:

```text
logical material + neighbour mask + stable coordinates
                         ↓
                 derived atlas frame

collision/routes remain separate authoritative gameplay data
```

The current automatic mode is Cardinal-16. Organic ranges are included as authored frames but gated Blob-47 and `(M+1)×(N+1)` dual-grid transitions remain the next rule-engine revision. See `EPOCH_17_4_DEFAULT_CANYON_TILESET.md`.
