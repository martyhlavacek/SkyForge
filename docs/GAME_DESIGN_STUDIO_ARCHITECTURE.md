# Skyforge Game Design Studio Architecture

> **Epoch 17.6 status:** The active Studio is focused on Level, Tuning, Assets, and Build. Music authoring and AI asset generation described below are retained only as historical or future design context.


**Status:** Approved governing design for Epochs 12–16  
**Revision:** 1.0  
**Date:** 2026-07-12

## 1. Purpose

The Skyforge Game Design Studio replaces the idea of a single expanding level editor with one integrated authoring environment containing four specialized workspaces:

1. Level Studio
2. Simulation and Tuning Lab
3. Music Studio
4. Asset Studio

All four workspaces operate against the same validated schemas and the same embedded Skyforge runtime used by the released game. The Studio must not maintain a second simplified game implementation.

## 2. Four package outputs

Each workspace owns one independent, versioned, data-only package:

| Workspace    | Extension      | Responsibility                                                                                    |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------- |
| Level Studio | `.sflevelpack` | Campaign order, levels, maps, collision, routes, terrain objects, timeline                        |
| Tuning Lab   | `.sftuning`    | Difficulty, enemies, weapons, movement, formations, encounters, bosses, pickups, equipment        |
| Music Studio | `.sfmusic`     | Cue definitions, adaptive stem metadata, FM/sample instruments, tracker composition source        |
| Asset Studio | `.sfassetpack` | Semantic asset roles, visual resources, animation, collision presets, altitude, shadows, tilesets |

An optional `.sfworkspace` file pins one package of each type and records the active level. It contains references only; it does not duplicate package content.

### 2.1 Portable package representation

Epoch 12 packages are UTF-8 JSON documents using custom file extensions. This choice provides:

- browser-native import and export;
- readable diffs;
- easy schema validation;
- safe inspection before loading;
- no executable scripts;
- no dependency on a browser ZIP implementation.

Later epochs may add a packed ZIP transport and an unpacked Git folder representation. Those formats must serialize to the same logical schema.

## 3. Dependency direction

Dependencies flow in one direction:

```text
Asset Pack   ─┐
Music Pack   ─┼─> Level Pack
Tuning Pack  ─┘
```

The Level Pack references stable IDs supplied by the other packages. Tuning, music, and asset packages must not depend on a level package. This permits assets, balance profiles, and scores to be reused across many collaborative level packs.

Every package manifest contains:

- format and schema version;
- package ID and semantic version;
- name, description, authors, and license;
- engine compatibility range;
- dependencies and version ranges;
- tags;
- creation and modification timestamps;
- external resource metadata.

## 4. Security and trust boundary

Packages are data only. They may not contain JavaScript, WebAssembly, shader source, HTML, or executable plug-ins in the initial system.

Import must:

1. parse JSON;
2. validate the package schema;
3. validate dependency versions;
4. detect duplicate IDs;
5. validate cross-package references;
6. reject unsupported schema versions;
7. report errors without mutating active content.

External audio and image resources are referenced through declared resources with media type, provenance, attribution, optional size, and optional SHA-256 metadata.

## 5. Workspace architecture

The Studio shell contains:

- top-level workspace tabs;
- package import/export controls;
- package and dependency status;
- an embedded shared game runtime;
- build validation;
- workspace persistence;
- direct access to the full spatial/timeline Level Studio.

The shared runtime communicates through a constrained message protocol supporting:

- start and restart;
- pause and resume;
- timeline seek;
- time scale;
- invulnerability for observation;
- runtime state reporting.

Epoch 12 establishes this bridge. Epoch 13 adds live tuning application, deterministic snapshots, and video-style scrubbing.

## 6. Level Studio package

A Level Pack may contain one level or a collaborative campaign pack. It includes:

- campaign manifest and level order;
- `LevelDef` timelines;
- Level Package v2 manifests;
- tile maps;
- authoritative collision;
- route sets;
- terrain objects;
- biomes.

The existing Level Studio can send its unsaved working project to the Studio shell as an `.sflevelpack`. A loaded Level Pack can also be pushed back into the Level Studio.

## 7. Tuning package

A Tuning Pack owns behavioural and balance definitions:

- difficulty modifiers;
- enemies;
- weapons;
- projectile patterns;
- movement patterns;
- formations;
- encounters;
- bosses;
- pickups;
- equipment and progression values.

Epoch 12 exposes validated numeric editing and export. Epoch 13 implements:

- schema-generated live controls;
- hot application to the shared runtime;
- isolated test arenas;
- telemetry;
- A/B comparison;
- snapshot-based seeking.

## 8. Music package

A Music Pack contains both runtime and editable source metadata:

- adaptive cue definitions;
- rendered stem resource references;
- FM instruments;
- sample instruments;
- tracker composition metadata;
- tempo, meter, order, patterns, and notes.

Changing BPM metadata does not time-stretch an already rendered audio file. The full tracker editor, instrument synthesis, rendering, and level-synchronized composition workflow are Epoch 15 features.

## 9. Asset package

An Asset Pack defines presentation separately from gameplay behaviour:

- stable asset ID;
- semantic kind and roles;
- resource reference or procedural source key;
- dimensions and pivot;
- collision preview;
- animations;
- altitude;
- shadow asset and offsets;
- tileset and autotile metadata;
- provenance and licensing.

An enemy definition references an asset ID but remains part of tuning. Replacing artwork must not require rewriting enemy behaviour or levels.

## 10. Content compiler

The Studio compiler consumes one package of each type and a workspace lock. It must:

- resolve dependencies in order;
- verify semantic version ranges;
- detect cycles and duplicate packages;
- detect duplicate content IDs;
- verify level music references;
- verify enemy and equipment asset references;
- verify the active level;
- produce a deterministic build fingerprint;
- produce a human-readable compile report.

The first compiler emits a validated compiled-content manifest. Later epochs add copying, hashing, atlas packing, music rendering, dead-resource elimination, and production build integration.

## 11. Collaboration model

The initial collaboration model is asynchronous:

1. collaborators exchange package files or unpacked folders;
2. packages identify authors and versions;
3. the workspace pins compatible versions;
4. the compiler reports missing or incompatible dependencies;
5. package files remain diff-friendly and mergeable.

Real-time multi-user editing is not required for the first Studio release. It may be added after package identity, migrations, and conflict rules are stable.

## 12. Epoch sequence

### Epoch 12 — Studio foundation

- four package schemas;
- package codec;
- dependency resolver;
- workspace format and persistence;
- deterministic compiler;
- Studio shell;
- Level Studio bridge;
- shared runtime bridge;
- foundational tuning, music, and asset views;
- package import/export.

### Epoch 13 — Simulation, tuning, and timeline

- schema-generated live tuning overlays;
- isolated arenas;
- video-style transport;
- snapshot-assisted state reconstruction and short deterministic authored-event replay;
- attention markers;
- telemetry and A/B comparison.

### Epoch 14 — Asset Studio

- image import;
- sprite and animation preview;
- shadow, altitude, hardpoint, and collision editing;
- tileset construction;
- atlas packing;
- asset-resource validation.

### Epoch 15 — Music Studio ✅ Implemented

- tracker pattern and order editors;
- note, instrument, velocity, duration, effect, swing, and quantization data;
- FM and sample instrument authoring;
- on-screen instrument audition keyboard;
- channel-to-stem routing and adaptive-state gains;
- boss/victory/defeat transition authoring;
- level-runtime offset synchronization;
- deterministic FM stem/full-mix rendering;
- WAV export, loop-discontinuity analysis, and embedded runtime resources;
- IndexedDB persistence and audio-resource integrity validation.

### Epoch 16 — Collaboration and production compiler ✅ Implemented

- schema-v2 migration and content revisions;
- unpacked Git folder mode;
- deterministic dependency locks;
- review comments and change reports;
- production live-resource compiler;
- dead-resource reporting and content-addressed output;
- build budgets and desktop/mobile browser matrix;
- contributor documentation and checked-in collaboration examples.

## 13. Acceptance principles

The Studio architecture is successful when:

1. all four package types validate independently;
2. a workspace can be reopened and resolve its four packages;
3. a collaborator can exchange a Level Pack without copying all assets and music;
4. missing dependencies fail clearly;
5. the Level Studio can export its unsaved project as a Level Pack;
6. the embedded runtime is the actual game runtime;
7. package imports cannot execute code;
8. a deterministic compiler manifest is produced;
9. package boundaries remain compatible with future packed and folder transports;
10. later editors can be added without rewriting the core game.

## 13. Implemented simulation transport boundary

Epoch 13 keeps the authoritative runtime inside the embedded game iframe. The React Studio sends data-only commands through `postMessage`; the iframe validates and applies them to the normal Phaser systems.

### Runtime commands

- pause and resume;
- restart;
- seek and ±0.25 second step;
- time scale from 0.25× to 4×;
- configure arena;
- apply or restore a tuning overlay;
- change the snapshot interval.

### Runtime observations

- current scene, level, time, duration, and pause state;
- active arena;
- music state;
- lightweight snapshot index;
- bounded telemetry stream;
- enemy/projectile counts, survivability, multiplier, and intensity.

Full snapshots never cross into the React host. This prevents large entity arrays from being copied through `postMessage` four times per second and keeps restoration ownership in the game runtime.

### Reconstruction guarantees

The transport restores the visible and gameplay-relevant authoring state at an anchor, then advances the short remainder. It reconstructs player resources, terrain, enemies, enemy weapon timers, projectiles, pickups, score, and multiplier tier. Exact replay equivalence is not guaranteed for particles, transient audio, boss internal phase state, or physics contact caches.


## Epoch 14 production asset boundary

Epoch 14 proves the Asset Pack resource and presentation contract. PNG/WebP imports may be embedded in the portable JSON package envelope and are verified by SHA-256 and byte count. Working packages containing image data are stored in IndexedDB, while a lightweight shell remains in local storage.

Asset Packs own visual identity, frame and animation layout, pivots, presentation collision previews, hardpoints, altitude, shadows, tileset metadata, atlases, provenance, and curation status. Tuning Packs continue to own behaviour. Level Packs continue to own authoritative terrain collision and spatial placement.

The runtime preview bridge consumes a validated Asset Pack but does not automatically replace all production rendering. Adoption of a visual definition by a gameplay entity remains an explicit stable-ID reference and must pass package compilation.

Epoch 16 implements unpacked Git resource folders, resource copying, dead-resource removal, package migrations, dependency locks, and final release compilation. Optional ZIP convenience transport remains a later usability enhancement.



## Epoch 15 production music boundary

Epoch 15 proves the editable-source-to-rendered-resource contract. Music Packs contain collaboration source and declared runtime audio, while the game loads validated cue and resource data. Tracker synthesis is an authoring operation, not a gameplay dependency.

The deterministic renderer is intentionally narrow: it renders the built-in simplified two-operator FM instruments, tracker timing, effects, channels, stems, and WAV output. Sample resources are preserved and validated, but decoding is deferred to avoid browser-codec variance in deterministic source renders.

The runtime bridge applies the active Music Pack inside the embedded iframe, previews a cue from an authored state and offset, and restores the built-in registry. No package command may carry executable code.

Epoch 16 implements unpacked collaboration transport, migrations, locks and hashes, dead-resource removal, package-level review gates, device-test configuration, and release compilation. Deterministic sample decoding, render workers/progress, automatic loop repair, and Music-specific undo remain optional post-foundation hardening.


## Epoch 16 completed production architecture

### Package schema v2

All packages carry `manifest.contentRevision` and `reviewComments`. Workspaces also carry review comments. The migration layer upgrades schema-v1 envelopes without changing content IDs or gameplay values.

### Folder representation

The canonical Git form is an unpacked directory with `skyforge.package.json`, `payload/index.json`, one JSON file per stable item, `resources/index.json`, and binary resource files. The order index makes array order explicit and deterministic.

### Lock and review gate

A workspace lock pins package versions, revisions, fingerprints, and resource metadata. Package review comments are included in package fingerprints. Open blocking comments stop production compilation.

### Production resource compiler

Release compilation resolves the package graph, validates the lock, calculates live resources, verifies and hashes bytes, removes dead declarations, assigns content-addressed paths, and emits sanitized runtime package documents and a release manifest. Atlas pixels remain authored Asset Pack resources; the compiler preserves atlas frame metadata rather than repacking unpredictably.

### Operational boundary

The Studio remains a data authoring and preview host. The Node compiler is the reproducible release path. Neither package imports nor release compilation may execute package-provided code.

## Epoch 17 AI Asset Foundry boundary

The AI Asset Foundry is an Asset Studio authoring subsystem, not a fifth package type and not a runtime game dependency. Asset Packs own the complete creative lineage: brief, prompt, generation job, candidate hierarchy, processing recipe, runtime-test evidence and approval. Tuning Packs continue to own behaviour; Level Packs continue to own placement and collision.

The browser host communicates only with a local, fixed-function image gateway. The gateway owns credentials and external requests. Both API-backed and manual ChatGPT workflows create identical package records. Imported outputs are inert image resources.

An assignment proposal is the only Foundry operation allowed to modify another package. It is applied by the Studio host after validating package identity and the previous target value. Package review comments and dependency locks then govern release like any other authored change.

Production compilation intentionally ignores Foundry-only lineage when calculating live runtime resources. Only final asset, tileset and atlas references keep image bytes alive.
