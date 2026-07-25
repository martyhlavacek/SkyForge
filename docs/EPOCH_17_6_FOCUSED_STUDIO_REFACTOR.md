# Epoch 17.6 — Focused Studio Refactor

**Release:** SkyForge 0.8.6  
**Date:** 2026-07-13  
**Source baseline:** Epoch 17.5 / 0.8.5

## Objective

Reduce the Game Design Studio to the workflows needed for gameplay, encounter tuning, level construction, approved asset integration, validation and release compilation. Music composition and AI-assisted asset generation are deferred to external workflows.

## Active Studio scope

The Studio now exposes four workspaces:

1. **Level** — maps, materials, collision, routes, objects, timeline events, validation and embedded preview.
2. **Tuning** — enemies, weapons, formations, encounters, bosses, difficulty, arenas and telemetry.
3. **Assets** — import, inspect, assign and validate approved assets, atlases and tilesets.
4. **Build** — dependency locks, validation, production compilation and export.

## Removed systems

### Music authoring

Removed:

- tracker/FM composer workspace;
- pattern, channel, instrument and composition editors;
- music preview synthesizer;
- authoring-engine tests and composer documentation.

Retained:

- adaptive runtime music playback;
- `.sfmusic` schema, import, validation, resource verification, dependency locking and production compilation;
- full music-package IndexedDB persistence for imported packages;
- five compiled demonstration stems and two runtime cue definitions.

The built-in music package now contains no tracker instruments or composition source.

### AI Asset Foundry

Removed:

- prompt/job/candidate/approval workspace;
- provider gateway and local gateway server;
- pixel-processing authoring pipeline;
- provider-contract and gateway-security scripts/tests;
- Foundry environment variables and operational documentation.

Retained:

- approved asset, resource, atlas and tileset schemas;
- external `.sfassetpack` import/export and validation;
- runtime asset preview and assignment workflows;
- legacy Foundry schema fields for backward-compatible package parsing.

The built-in asset package contains approved assets but no briefs, generation jobs, candidates or processing recipes.

## Structural refactor

- Extracted the Level, Tuning and Build workspaces from `StudioApp.tsx` into `FocusedStudioWorkspaces.tsx`.
- Reduced active Studio tabs from five to four.
- Reduced Asset Studio sub-tabs by removing Foundry.
- Removed obsolete scripts, source modules, tests, CSS and quick-start documentation.
- Regenerated folder examples, dependency lock and compiled release example from the focused packages.
- Updated README, user manual, architecture, troubleshooting and specialist documentation to describe the external asset/music workflow.

## Measured reduction

| Measure | Epoch 17.5 | Epoch 17.6 | Reduction |
|---|---:|---:|---:|
| Source TS/TSX/CSS lines | 33,307 | 29,317 | 3,990 / 11.98% |
| Studio TS/TSX/CSS lines | 13,082 | 9,092 | 3,990 / 30.50% |
| Studio files | 46 | 37 | 9 / 19.57% |
| Production JavaScript | 2,365,800 B | 2,304,990 B | 60,810 B / 2.57% |
| Gzipped JavaScript | 606,094 B | 588,256 B | 17,838 B / 2.94% |
| CSS | 36,798 B | 30,285 B | 6,513 B / 17.70% |

The Phaser vendor chunk is unchanged at 1,375,726 bytes. The reduction is concentrated in Studio authoring code rather than game runtime capability.

## Compatibility contract

Epoch 17.6 intentionally preserves the four-package workspace contract: level, tuning, music and asset. Existing valid packages continue to parse and compile. The removed Foundry and composer data structures remain accepted by the schemas, but the Studio no longer creates or edits them.

## Result

The project is now centered on game mechanics, encounter pacing, tuning and level design while retaining a stable handoff path for externally produced visual and music packages.
