# Skyforge Game Design Studio User Manual

**Manual version:** 1.0  
**Applies to:** Skyforge Epoch 17  
**Primary applications:** Game, Level Studio, Focused Game Design Studio
**Audience:** Level designers, tuning designers, composers, asset creators, reviewers, and master integrators

---

## Table of contents

1. [Purpose and operating model](#1-purpose-and-operating-model)
2. [Install and start Skyforge](#2-install-and-start-skyforge)
3. [Understand the three applications](#3-understand-the-three-applications)
4. [Understand packages, workspaces, locks, and builds](#4-understand-packages-workspaces-locks-and-builds)
5. [Game Design Studio orientation](#5-game-design-studio-orientation)
6. [Level Studio](#6-level-studio)
7. [Simulation and Tuning Lab](#7-simulation-and-tuning-lab)
8. [External music package workflow](#8-external-music-package-workflow)
9. [Asset Studio](#9-asset-studio)
10. [Deferred asset-generation workflow](#10-deferred-asset-generation-workflow)
11. [Build and Package Compiler](#11-build-and-package-compiler)
12. [Collaborative distribution](#12-collaborative-distribution)
13. [Master integration workflow](#13-master-integration-workflow)
14. [Review comments, conflicts, and versioning](#14-review-comments-conflicts-and-versioning)
15. [Validation and quality assurance](#15-validation-and-quality-assurance)
16. [Troubleshooting](#16-troubleshooting)
17. [Command reference](#17-command-reference)
18. [Current limitations](#18-current-limitations)
19. [Glossary](#19-glossary)
20. [Release handoff checklist](#20-release-handoff-checklist)

---

# 1. Purpose and operating model

The Skyforge Game Design Studio is a package-based authoring environment for a vertical-scrolling shoot-'em-up. It separates authored content from the game runtime so different contributors can work independently and return files that can be validated and combined into a master build.

The Studio has four primary content workspaces:

| Workspace | Main responsibility | Export |
|---|---|---|
| Level | Levels, terrain, encounters, timeline, routes, checkpoints | `.sflevelpack` |
| Tuning | Enemies, weapons, movement, difficulty, equipment, rewards | `.sftuning` |
| Music | Tracker source, FM instruments, adaptive cues, rendered audio | `.sfmusic` |
| Assets | Sprites, tiles, animation metadata, shadows, atlases, Foundry history | `.sfassetpack` |

A lightweight workspace file identifies which four packages are loaded together:

```text
.sfworkspace
```

A dependency lock records the exact approved package versions, revisions, fingerprints, and resource hashes:

```text
.sflock
```

The operating principle is:

```text
Author packages independently
        ->
Preview them together in the real game runtime
        ->
Validate dependencies and references
        ->
Lock the approved combination
        ->
Compile a production release
```

## 1.1 The Studio is not a second game engine

The embedded simulation uses the same Phaser runtime and gameplay systems as the playable game. This prevents editor-only behaviour from diverging from the final build.

## 1.2 Packages are data-only

Imported packages may contain declarative JSON and approved image or audio resources. They cannot contain executable scripts, imported HTML, plug-ins, arbitrary WebAssembly, or provider credentials.

## 1.3 Stable IDs are contracts

Packages communicate through stable IDs. For example:

```json
{
  "enemyDefinitionId": "canyon_light_interceptor",
  "musicCueId": "canyon_combat_01",
  "visualAssetId": "canyon_interceptor_sprite"
}
```

Renaming a stable ID can break references in another contributor's package. Treat IDs as public interfaces.

---

# 2. Install and start Skyforge

## 2.1 Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- Node.js 22 LTS is recommended
- npm
- A current desktop browser
- Git for folder-based collaboration
- Playwright Chromium and WebKit for full browser testing

Check Node:

```bash
node --version
```

## 2.2 Install

From the project directory:

```bash
npm ci
```

Use `npm ci` for a clean reproducible installation. Use `npm install` only when intentionally changing dependencies.

## 2.3 Start the game and studios

```bash
npm run dev
```

Open the URLs printed by Vite. Under the default development configuration:

```text
Game:               http://localhost:5173/
Level Studio:       http://localhost:5173/editor.html
Game Design Studio: http://localhost:5173/studio.html
```

## 2.4 Focused Studio scope

Epoch 17.6 requires no AI gateway or provider secret. Start Vite normally and open `/studio.html`. The active tabs are Level, Tuning, Assets, and Build.

## 2.5 First verification

Run the release gate:

```bash
npm run audit:release
npm run build:base:verify
```

Install browser binaries and run browser tests:

```bash
npx playwright install chromium webkit
npm run test:e2e
```

---

# 3. Understand the three applications

## 3.1 Game

The game at `/` is the normal player experience. It includes the title screen, hangar, equipment and economy flow, missions, results, terrain, enemies, bosses, and adaptive music.

Use it for final uninterrupted playtests.

## 3.2 Level Studio

The Level Studio at `/editor.html` is the specialist spatial and timeline editor. It is responsible for map geometry, terrain, collision, routes, objects, encounters, and level-package import and export.

Use it when detailed map authoring is the main task.

## 3.3 Game Design Studio

The Game Design Studio at `/studio.html` combines:

- Level workspace
- Tuning workspace
- External music package import and runtime support
- Asset workspace for approved artwork, tilesets, atlases, and references
- Build workspace
- Shared embedded runtime
- Package import and export
- Dependency locks and production compilation
- Review comments

Use it for cross-package work, simulation, live tuning, approved-asset preparation, integration, and release preparation.

---

# 4. Understand packages, workspaces, locks, and builds

## 4.1 Four authored package types

### Level Pack - `.sflevelpack`

Contains:

- campaign order
- level definitions
- terrain maps
- collision data
- routes
- objects
- encounters and timeline events
- checkpoints
- biome references

### Tuning Pack - `.sftuning`

Contains:

- enemy definitions
- weapons and projectile patterns
- movement patterns
- formations and encounters
- bosses
- difficulty profiles
- pickups and reward values
- equipment and progression values

### Music Pack - `.sfmusic`

Contains runtime-ready cue definitions, adaptive-state gains, transitions, and rendered audio resources. Legacy packages may also contain tracker compositions and instruments, but the focused Studio does not edit them.

### Asset Pack - `.sfassetpack`

Contains:

- sprite and image resources
- animations
- pivots
- collision shapes
- hardpoints
- altitude and shadow metadata
- tilesets and autotile rules
- atlas metadata
- provenance and licensing
- optional legacy generation-lineage records retained for package compatibility

## 4.2 Workspace - `.sfworkspace`

A workspace points to one package of each type. It is a combination file, not the content itself.

Distributing only the workspace is not enough. Recipients also need all referenced packages.

## 4.3 Dependency lock - `.sflock`

The lock pins:

- package type
- package ID
- semantic version
- content revision
- deterministic package fingerprint
- resource IDs
- resource byte counts
- resource hashes where available

Use a lock to prove which exact content set produced a build.

## 4.4 Generated build files

`.sfbuild.json` and `.sfrelease.json` are generated compilation outputs. They are evidence and runtime inputs, not primary authoring files.

Do not hand-edit generated manifests.

## 4.5 Portable package versus Git folder

Portable package:

```text
canyon-levels-1.2.0.sflevelpack
```

Best for email, cloud storage, and simple import/export.

Unpacked folder:

```text
canyon-levels/
  skyforge.package.json
  payload/index.json
  payload/<group>/<stable-id>.json
  resources/index.json
  resources/<binary files>
```

Best for Git review, merging, and collaboration involving multiple changes to one package.

---

# 5. Game Design Studio orientation

The Studio opens with package-backed workspaces and a shared runtime panel.

## 5.1 Main workspaces

- **Level Studio** - embeds or communicates with the level editor
- **Simulation & Tuning Lab** - live controls, isolated arenas, timeline and A/B comparison
- **External music packages** - imported adaptive cues and rendered audio
- **Asset Studio** - asset import, curation, animation metadata, tilesets, atlases and references
- **Package Compiler** - validation, locks, review comments and production compilation

## 5.2 Shared Simulation Runtime

The runtime is an embedded instance of the real game. Depending on the active workspace, it can:

- launch or reload a level
- run an isolated enemy, weapon, formation, encounter, boss, route, or loadout test
- pause and resume
- restart
- seek the level timeline
- display telemetry
- preview transient tuning
- preview transient music
- preview a selected visual asset

Transient previews do not alter canonical package content until you explicitly save or apply a transaction.

## 5.3 Package state and persistence

Small package metadata is retained in browser storage. Larger image- and audio-bearing packages use IndexedDB.

Always export important work. Browser storage is a convenience, not a project backup.

## 5.4 Review comments

Packages can contain:

- `note` - context only
- `suggestion` - recommended non-blocking change
- `blocking` - release cannot compile until resolved

Resolve completed comments instead of deleting them so the review trail remains available.

---

# 6. Level Studio

Open:

```text
http://localhost:5173/editor.html
```

## 6.1 Main workspaces

### Spatial

Use for:

- map layers
- terrain materials
- collision
- navigation routes
- gates and barriers
- object positioning
- clearance analysis

### Timeline

Use for:

- enemy encounters
- recovery windows
- terrain-state events
- checkpoints
- scroll changes
- boss timing

### Preview

Runs unsaved editor data in the game without mutating canonical content.

## 6.2 Spatial modes

- **Select (`V`)** - inspect cells and directly select or drag gates and barriers
- **Paint (`B`)** - place the selected terrain material
- **Terrain (`T`)** - paint and regenerate Cardinal-16 transition variants
- **Erase (`E`)** - switch Paint to the empty material
- **Collision (`C`)** - edit navigable boundaries
- **Routes (`R`)** - edit expected player route and clearance
- **Objects (`O`)** - position gates, barriers, and dynamic objects
- **Analysis (`A`)** - inspect route width, reaction time, and combined terrain/combat warnings

## 6.3 Typical level workflow

1. Select or create the level.
2. Choose a layer and material.
3. Paint broad terrain shapes.
4. Run Autotile to regenerate edge variants.
5. Edit collision boundaries independently of artwork.
6. Draw or adjust the expected player route.
7. Position dynamic terrain objects.
8. Add encounters and checkpoints in the timeline.
9. Inspect route-clearance and pressure warnings.
10. Preview unsaved changes.
11. Correct validation errors.
12. Export the package.

## 6.4 Default image-backed canyon tileset

The Canyon biome ships with **Skyforge Canyon Default**, a normalized 512×256 PNG atlas containing 128 exact 32×32 frames. It is loaded automatically in both the Level Studio canvas and the Phaser runtime.

The material browser shows actual atlas thumbnails for:

- animated river water;
- shoreline and foam variants;
- Cardinal-16 cliff surfaces;
- organic cliff-edge stamps;
- dust overlays;
- metal platforms.

The authoritative map stores logical material IDs and Cardinal masks. Atlas frames are derived deterministically, so changing the artwork does not rewrite the map. Water advances through synchronized frame sets while static materials choose stable variants from cell coordinates.

The checked-in source and build pipeline are:

```text
art-source/skyforge_canyon_master.png
scripts/build-canyon-tileset.py
public/assets/terrain/skyforge_canyon_terrain.png
public/assets/terrain/skyforge_canyon_props.png
public/assets/terrain/skyforge_canyon_tileset.json
```

The props atlas is visible in Asset Studio and reserved for the forthcoming stamp/prefab workflow. Terrain collision remains independent and authoritative; the visual atlas never creates collision by itself.

## 6.5 Layer controls

The Level Studio supports:

- active layer selection
- visibility toggle
- editor lock
- solo preview
- depth/order movement
- zoom
- vertical row navigation
- fill and erase
- undo and redo

Collision geometry remains authoritative. Changing a cliff image does not silently change the collision route.

## 6.6 Timeline editing

Timeline events use stable editor identities. Sorting, insertion, deletion, and undo do not depend on the event's array position.

Use timeline events for authored changes such as:

- start encounter
- checkpoint
- recovery period
- gate state
- barrier state
- scroll-speed change
- boss transition

## 6.7 Video-style navigation

The Game Design Studio's runtime transport can be used with the level to:

- play and pause
- step forward or backward
- change speed from 0.25x to 4x
- scrub to a timestamp
- set a loop region
- jump to attention markers

Seeking uses periodic snapshots and deterministic reconstruction. It is an authoring transport, not a certified replay recording.

## 6.8 Export and import

Export is blocked when structural, cross-reference, collision, or route errors exist.

When using Level Package v2 files directly, import all required package documents together. Missing map, collision, route, object, biome, or level documents cause validation errors.

When working in the unified Studio, export the resulting `.sflevelpack` for collaboration.

## 6.9 Level designer handoff

Return:

- revised `.sflevelpack`
- package version and content revision
- short change summary
- unresolved comments
- dependency changes
- validation result
- screenshots or recordings for important visual changes

See `docs/quickstarts/LEVEL_DESIGNER.md`.

---

# 7. Simulation and Tuning Lab

Open the Game Design Studio and select **Tuning**.

## 7.1 Simulation scopes

Choose the smallest environment that demonstrates the behaviour being changed:

- full level
- enemy
- weapon
- formation
- encounter
- boss
- terrain route
- ship loadout

Focused arenas make tuning faster and reduce unrelated variables.

## 7.2 Live controls

Controls are generated from schemas and may expose values such as:

- enemy health
- movement speed
- acceleration
- fire interval
- projectile speed
- aim error
- formation spacing
- weapon damage
- shield and energy values
- rewards and currency
- difficulty modifiers

A transient tuning overlay is sent to the real runtime. It does not permanently alter the active package until the package is updated and exported.

## 7.3 Recommended A/B workflow

1. Select the smallest suitable arena.
2. Click **Set A Baseline**.
3. Run long enough to collect representative telemetry.
4. Capture A.
5. Change one parameter group.
6. Repeat the same section using a loop or attention marker.
7. Capture B.
8. Inspect the telemetry comparison and tuning diff.
9. Confirm the result with a full uninterrupted level run.
10. Export `.sftuning` and the review report.

Change one conceptual group at a time. Changing health, speed, fire rate, and projectile density simultaneously makes the result difficult to interpret.

## 7.4 Runtime transport

Available authoring controls include:

- play and pause
- restart
- forward and reverse step
- time scale
- timeline scrubber
- loop in and loop out
- attention-marker jumps
- snapshot interval

Snapshots can restore player status, score, multiplier, terrain state, enemies, projectiles, pickups, and broad boss identity. Particle phase, transient audio, exact animation phase, and some boss internals may reconstruct approximately.

## 7.5 Attention analysis

The Studio automatically creates markers for:

- encounters
- checkpoints
- terrain-state events
- recovery periods
- bosses
- local intensity peaks
- warnings

Use these markers to jump directly to places that require tuning.

## 7.6 Telemetry

The runtime reports values including:

- active enemies
- enemy projectiles
- player projectiles
- survivability
- multiplier
- frame time
- calculated intensity

A/B comparison includes mean and peak values and p95 frame time.

## 7.7 Tuning designer handoff

Return:

- revised `.sftuning`
- A/B summary
- affected content IDs
- assumptions and intended difficulty
- any required Level or Asset Pack updates
- unresolved review comments

See `docs/quickstarts/TUNING_DESIGNER.md`.

---

# 8. External music package workflow

The in-Studio Tracker/FM editor was removed in Epoch 17.6. Adaptive music playback remains part of the game runtime and `.sfmusic` remains a supported package type.

## 8.1 Prepare music externally

Create, edit, mix, and render music outside SkyForge. Package completed cue definitions and audio resources as a valid `.sfmusic` package.

## 8.2 Import and validate

Use the Game Design Studio **Import** action. Audio resources are checked for supported media types, declared byte counts, and SHA-256 integrity when embedded.

## 8.3 Runtime preview and release

The shared runtime applies the active music package when a simulation starts or synchronizes. The Build workspace includes the music package in dependency resolution, locks, production compilation, and release export.

## 8.4 Compatibility boundary

Legacy packages may still contain instruments and tracker compositions. They remain schema-compatible for migration and collaboration, but Epoch 17.6 provides no authoring interface for them.

# 9. Asset Studio

Open the Game Design Studio and select **Assets**.

The Asset workspace contains conventional import, curation, animation, presentation, tileset, atlas, preview, and reference-repair tools.

## 9.1 Import visual resources

Supported visual imports focus on PNG and WebP.

When importing, record:

- name
- author
- source
- license
- creation tool
- timestamp
- notes

Imported resources are verified by byte count and SHA-256 where available.

## 9.2 Semantic classification

Assign each asset a kind and roles. Examples:

- aircraft
- tank
- turret
- terrain
- projectile
- effect
- pickup
- UI
- shadow

Semantic roles determine which game definitions are compatible with the visual.

## 9.3 Sprite slicing and animation

The Asset Studio can:

- slice sprite sheets
- create named frame sequences
- set frame rate
- set looping
- define idle or other animation states

Advanced pose consistency, onion skinning, layered effects, and destruction rigging are not yet a complete dedicated Animation Lab.

## 9.4 Presentation metadata

Configure:

- pivot
- scale
- circle, rectangle, or polygon collision
- weapon hardpoints
- engine hardpoints
- effect or attachment points
- altitude
- separate shadow
- shadow offset and scale

## 9.5 Tilesets and autotiling

An image may be promoted to a tileset. Configure:

- tile dimensions
- logical material
- cardinal rules
- dual-grid rules
- Wang-style metadata
- mask mappings
- collision role
- animated or destroyed variants where available

## 9.6 Deterministic atlases

Atlas generation uses stable input ordering and stable frame keys. The same approved inputs should produce the same layout metadata.

The production compiler copies approved atlas resources; it does not repack them differently during release.

## 9.7 Preview environments

Preview assets against:

- neutral background
- canyon
- ice
- space
- station
- combat context

Use **Preview in runtime** to inspect the asset inside the real Phaser game.

Check:

- readability at native scale
- contrast against intended biomes
- collision fairness
- hardpoint alignment
- shadow separation
- mobile visibility
- performance at formation or stress counts

## 9.8 Reference health

The Studio reports:

- missing references
- candidate or rejected assets used by tuning
- unused assets
- unresolved visual assignments

Replacement proposals should be reviewed before changing another package.

## 9.9 Asset creator handoff

Return:

- revised `.sfassetpack`
- provenance and licensing
- approval state
- new or changed stable IDs
- reference-replacement proposals
- runtime test reports
- mobile review status

See `docs/quickstarts/ASSET_CREATOR.md`.

---

# 10. Deferred asset-generation workflow

The AI Asset Foundry and local provider gateway were removed from the active application in Epoch 17.6. Generate assets with external tools, then import approved PNG or WebP files through Asset Studio.

Legacy Foundry lineage fields remain accepted by the package schema so older `.sfassetpack` files do not become unreadable. The focused Studio does not create, edit, or require briefs, generation jobs, candidates, processing recipes, runtime-test records, or assignment proposals.

# 11. Build and Package Compiler

Open the Game Design Studio and select **Build**.

## 11.1 Build responsibilities

The Build workspace:

- validates all four packages
- resolves dependencies
- reports missing or duplicate IDs
- manages review comments
- creates or imports a dependency lock
- detects lock drift
- identifies live and dead resources
- verifies bytes and hashes
- compiles sanitized runtime package JSON
- copies content-addressed resources
- emits a deterministic release manifest

## 11.2 Recommended integration sequence

1. Import the four candidate packages.
2. Import the intended workspace.
3. Import the previous lock if validating an existing release.
4. Read package changes and review comments.
5. Resolve missing references.
6. Preview affected content.
7. Run package compilation.
8. Resolve all blocking errors.
9. Export a new dependency lock.
10. Run production compilation.
11. Archive the accepted packages, workspace, lock, and release manifest.

## 11.3 Dead resources

The compiler reports resources declared in an authored package but not referenced by production content.

This is expected for rejected Foundry candidates and earlier revisions. Dead resources remain in the collaboration package but are excluded from the game release.

## 11.4 Blocking conditions

Compilation can fail because of:

- missing package dependency
- incompatible package version
- duplicate stable ID
- missing internal reference
- unresolved blocking comment
- package drift from lock
- changed resource hash or byte count
- unsafe URI
- missing live resource
- invalid package schema

Do not bypass these conditions by editing generated build files.

---

# 12. Collaborative distribution

## 12.1 Recommended ownership model

Use one primary owner for each package at first:

| Role | Owns |
|---|---|
| Level designer | `.sflevelpack` |
| Tuning designer | `.sftuning` |
| Composer | `.sfmusic` |
| Asset creator/curator | `.sfassetpack` |
| Master integrator | `.sfworkspace`, `.sflock`, accepted package set and release |

Contributors should receive all four baseline packages so they can preview their work in context, even if they edit only one.

## 12.2 Baseline distribution

The master integrator distributes:

```text
skyforge-levels-1.0.0.sflevelpack
skyforge-tuning-1.0.0.sftuning
skyforge-music-1.0.0.sfmusic
skyforge-assets-1.0.0.sfassetpack
skyforge-main.sfworkspace
skyforge-main.sflock
```

Each contributor imports the same baseline.

## 12.3 Contributor return package

A contributor normally returns only the package they own, for example:

```text
skyforge-music-1.1.0.sfmusic
```

Also return:

- change summary
- test results
- new IDs
- removed or renamed IDs
- dependency changes
- unresolved comments
- screenshots or audio previews where useful

## 12.4 Simple distribution options

Portable packages can be exchanged through:

- email
- Google Drive
- Dropbox
- shared project folders
- Discord or another file-sharing service

## 12.5 Git workflow

Unpack:

```bash
npm run studio:unpack -- package.sfmusic ./work/music
```

Edit files under `payload/` and `resources/`.

Repack:

```bash
npm run studio:pack -- ./work/music ./out/package.sfmusic
```

`payload/index.json` records deliberate order. Do not rename stable IDs merely to change display order.

## 12.6 What not to send

Do not distribute:

- `node_modules`
- browser caches
- local IndexedDB storage
- `.env.local`
- API keys
- unlicensed third-party assets
- generated build files as the only source of a contribution

---

# 13. Master integration workflow

The master integrator owns acceptance, not every creative decision.

## 13.1 Receive a contribution

1. Preserve the previous approved package.
2. Record who submitted the new package and why.
3. Import the package into a copy of the master workspace.
4. Review migration warnings, package version, and content revision.
5. Read the change report and comments.
6. Compare stable IDs.
7. Check cross-package references.
8. Preview the affected levels or isolated arena.
9. Run package validation.
10. Check lock drift.
11. Request revisions if needed.

## 13.2 Accept a contribution

1. Resolve or accept review comments.
2. Confirm provenance for new image and audio resources.
3. Confirm runtime tests for affected content.
4. Update the workspace package reference.
5. Generate a new `.sflock`.
6. Run production compilation.
7. Run the release audit.
8. Archive the accepted package set and lock.
9. Tag or record the release identity.

## 13.3 Reject or return a contribution

Return the package with blocking comments targeting the smallest useful path. Explain the expected pass condition.

Do not manually copy isolated JSON fragments into the master package unless resolving a documented merge conflict.

## 13.4 Master archive structure

A practical approved-release folder:

```text
releases/2026-07-canyon-preview/
  packages/
    levels.sflevelpack
    tuning.sftuning
    music.sfmusic
    assets.sfassetpack
  skyforge-main.sfworkspace
  skyforge-main.sflock
  release-manifest.json
  validation-report.md
  change-summary.md
```

See `docs/quickstarts/MASTER_INTEGRATOR.md`.

---

# 14. Review comments, conflicts, and versioning

## 14.1 Comment severities

- **Note:** information or context
- **Suggestion:** improvement that does not block release
- **Blocking:** must be resolved before production compilation

## 14.2 Content revision versus semantic version

Use `contentRevision` for accepted changes during active collaboration when public compatibility has not yet been reconsidered.

Change semantic version when compatibility or external references change.

General guidance:

- Patch: corrections that preserve external IDs and expected behaviour
- Minor: additive content that remains compatible
- Major: breaking ID changes, removed content, or incompatible schema/contract change

## 14.3 Conflict rules

- Merge stable items by ID, not array position.
- Two changes to the same stable item require human review.
- Binary changes require updated hash and provenance.
- Stale assignment proposals must be recreated.
- Do not solve a lock conflict by deleting the lock.
- Regenerate the lock only after approving the new package set.

## 14.4 Renaming IDs

Avoid renaming stable IDs. When unavoidable:

1. identify every reference;
2. update all dependent packages or provide a migration;
3. treat the change as breaking;
4. increase the appropriate version;
5. record it prominently in the change summary.

---

# 15. Validation and quality assurance

## 15.1 Standard release audit

```bash
npm run audit:release
```

This runs lint, TypeScript, unit/content tests, AI gateway syntax checks, production build, budget checks, example production compilation, and dependency audit.

## 15.2 GitHub Pages base-path verification

```bash
npm run build:base:verify
```

## 15.3 Browser automation

```bash
npx playwright install chromium webkit
npm run test:e2e
```

Projects include desktop Chromium, Pixel 7 Chromium, and iPhone 14 WebKit profiles.

## 15.4 Physical device checks

Before a tagged release, test:

- current iPhone Safari
- one older supported iPhone
- Android Chrome
- desktop Chrome, Firefox, and Safari
- keyboard
- compatible controllers
- touch-only portrait play
- audio route changes
- background/resume
- ten-minute combat
- largest Music Studio render
- largest Asset Pack import

## 15.5 Asset approval checks

For production sprites:

- native-scale desktop preview
- physical-iPhone preview
- every intended biome
- single, formation, and stress-count views
- projectile contrast
- collision fairness
- shadow separation
- hardpoint alignment
- no unintended smoothing
- completed mobile test report

## 15.6 Final gameplay validation

Studio snapshots and isolated arenas accelerate authoring, but final approval requires an uninterrupted full-level run at normal time.

---

# 16. Troubleshooting

A longer reference is available in `docs/TROUBLESHOOTING.md`.

## 16.1 Node engine error

Symptom:

```text
SyntaxError ... node:util ... styleText
```

Fix: install Node 22 LTS, remove old `node_modules`, and run `npm ci` again.

## 16.2 Package will not import

Check:

- correct extension
- valid JSON envelope
- supported schema version
- complete embedded resources
- no unsafe URI
- package was not renamed without changing its internal manifest

## 16.3 Missing dependencies

Import all four packages and the intended workspace. A Level Pack may reference content from tuning, music, and assets.

## 16.4 Lock drift

Drift means one of the selected packages no longer matches the lock.

Review the changed package. If accepted, generate a new lock. Do not simply ignore drift.

## 16.5 Hash or byte-count mismatch

The binary resource differs from its declaration. Re-import the original resource or regenerate the package from the authoritative folder.

Do not manually alter a hash to make validation pass.

## 16.6 Browser storage warning or missing images

Export work immediately. Large packs use IndexedDB, but browser cleanup, private mode, quotas, or origin changes can remove local data.

Re-import the last exported package.

## 16.7 Audio will not play

Browser audio requires a user gesture. Click or tap inside the runtime, verify music/SFX settings, and test after reloading.

## 16.8 External asset or music package will not import

Validate the package or source file outside the Studio first. For images, use PNG or WebP and confirm the file is readable. For `.sfmusic`, confirm the package schema, audio media types, embedded byte counts, and SHA-256 hashes. Epoch 17.6 has no AI gateway or in-Studio music renderer.

## 16.12 Export is blocked in Level Studio

Inspect structural, collision, route, or cross-reference errors. Impossible corridors and missing package documents intentionally block export.

## 16.13 Playwright browsers missing

Run:

```bash
npx playwright install chromium webkit
```

---

# 17. Command reference

| Command | Purpose |
|---|---|
| `npm ci` | Clean dependency installation |
| `npm run dev` | Start game and Studio development server |
| `npm run build` | Typecheck and production build |
| `npm run build:release` | Production build and bundle budgets |
| `npm run typecheck` | TypeScript validation |
| `npm run lint` | ESLint validation |
| `npm test` | Unit and content tests |
| `npm run test:e2e` | Playwright browser suite |
| `npm run audit:release` | Full release gate |
| `npm run build:base:verify` | GitHub Pages base-path verification |
| `npm run studio:unpack -- <pack> <folder>` | Convert portable package to Git folder |
| `npm run studio:pack -- <folder> <pack>` | Repack Git folder |
| `npm run studio:lock -- <workspace> <dir> <lock>` | Create dependency lock |
| `npm run studio:compile -- <workspace> <dir> <lock> <out> [public]` | Compile release content |
| `npm run studio:example:compile` | Rebuild included collaboration example |

---

# 18. Current limitations

The Studio is a substantial production foundation, but the following areas remain incomplete or intentionally deferred:

- no Google-Docs-style simultaneous editing
- no complete visual package diff UI
- no persistent server-side project repository
- no full Animation and Effects Lab
- no advanced onion-skin pose correction
- no deterministic sample-instrument rendering in all cases
- no MIDI input
- no automatic music loop repair
- no advanced in-canvas pixel repaint
- no automatic palette library and cluster editor
- no production campaign of final visual assets yet
- physical-device QA must be run outside the current sandbox

These limitations should be considered when assigning work. Static and simple animated assets are supported; complex layered aircraft animation requires additional authoring tools or external cleanup.

---

# 19. Glossary

**Asset Pack:** Package containing visual resources and authoring metadata.  
**Attention marker:** Automatically or manually identified timeline point worth reviewing.  
**Candidate:** Generated or imported visual not yet approved.  
**Content revision:** Package revision number used during collaboration.  
**Dead resource:** Authored resource not referenced by the production build.  
**Dependency lock:** Exact record of package versions, fingerprints, and resources.  
**Foundry:** AI-assisted asset brief, generation, processing, testing, and approval workflow.  
**Hardpoint:** Named coordinate for weapons, engines, effects, or attachments.  
**Level Pack:** Package containing campaign and level-authoring data.  
**Live resource:** Resource referenced by approved runtime content.  
**Master candidate:** Selected visual reference used for controlled revisions.  
**Music Pack:** Package containing editable compositions, cues, instruments, and audio.  
**Package:** Independently versioned authoring unit.  
**Processed derivative:** Game-sized image created non-destructively from a source candidate.  
**Review comment:** Note, suggestion, or blocking package review record.  
**Stable ID:** Persistent content identity used by cross-package references.  
**Studio workspace:** Combination file selecting one package of each type.  
**Tuning Pack:** Package containing gameplay behaviour and balance values.  
**Workspace lock:** Reproducibility record for an approved package combination.

---

# 20. Release handoff checklist

## Contributor

- [ ] Started from the current baseline package set
- [ ] Edited only the assigned package unless cross-package work was approved
- [ ] Preserved stable IDs
- [ ] Increased content revision
- [ ] Updated semantic version if compatibility changed
- [ ] Resolved structural and reference errors
- [ ] Added provenance for new resources
- [ ] Ran the affected preview or simulation
- [ ] Added review comments for unresolved issues
- [ ] Exported the correct package
- [ ] Included a change summary and test result

## Master integrator

- [ ] Preserved previous approved package
- [ ] Imported contribution into a copy of master workspace
- [ ] Reviewed migrations, version, revision, and change report
- [ ] Checked stable IDs and cross-package references
- [ ] Previewed affected levels, tuning, music, or assets
- [ ] Confirmed licenses and provenance
- [ ] Resolved or accepted comments
- [ ] Confirmed no unresolved blocking comments
- [ ] Generated a new dependency lock
- [ ] Ran production compilation
- [ ] Ran `npm run audit:release`
- [ ] Ran browser and physical-device checks appropriate to the change
- [ ] Archived packages, workspace, lock, manifest, and change summary

---

## Related documents

- `docs/DOCUMENTATION_INDEX.md`
- `docs/PACKAGE_AUTHORING_AND_COLLABORATION.md`
- `docs/GAME_DESIGN_STUDIO_ARCHITECTURE.md`
- `docs/TUNING_GUIDE.md`
- `docs/MUSIC_DIRECTION_AND_ADAPTIVE_AUDIO.md`
- `docs/DEVICE_AND_PERFORMANCE_QA.md`
- `docs/SOLID_TERRAIN_NAVIGATION_AND_LEVEL_COMPOSER.md`
- `docs/TILE_ASSET_PIPELINE_AND_LEVEL_COMPOSER.md`

## Epoch 17.2 security notes

### Importing contributor packages

Treat every package as untrusted until Studio validation succeeds. The browser importer and folder tools enforce package schemas, safe authored IDs, resource integrity, and cross-package references. Folder unpacking refuses a non-empty destination unless you deliberately add `--force`.

### Deferred authoring systems

Epoch 17.6 removes the AI provider gateway and the Tracker/FM editor. No provider key or session token is used by the active application. Legacy package fields remain data-only and are still validated as untrusted input.


# Epoch 17.3 Level Studio interaction quick reference

| Action | Control |
|---|---|
| Select / safe mode | `V` |
| Paint | `B` |
| Terrain/autotile | `T` |
| Erase | `E` |
| Collision | `C` |
| Route | `R` |
| Object | `O` |
| Analysis | `A` |
| Fill visible viewport | `G` |
| Sample tile | Alt-click or right-click |
| Pan | Mouse wheel or Space-drag |
| Zoom | Ctrl/Command/Alt + wheel |
| Fit/default view | `F` |

The Level Studio uses one undo entry per continuous drag. Use the minimap to jump through the full vertical map. Select an object before dragging it; clicking empty space clears the object selection. The right inspector switches among Selection, Layer and Analysis. Hide the Simulation Runtime from the main Studio toolbar when maximum map space is needed.
