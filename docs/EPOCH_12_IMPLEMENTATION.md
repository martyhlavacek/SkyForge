# Epoch 12 Implementation — Game Design Studio Foundation

**Version:** 0.3.0  
**Implementation date:** 2026-07-12  
**Governing design:** `GAME_DESIGN_STUDIO_ARCHITECTURE.md`  
**PDR review:** `EPOCH_12_PDR_REVIEW.md`

## 1. Outcome

Epoch 12 converts the existing Level Composer into one workspace within a broader Skyforge Game Design Studio.

The Studio now coordinates four independent content packages:

- `.sflevelpack`
- `.sftuning`
- `.sfmusic`
- `.sfassetpack`

A `.sfworkspace` pins one active package of each type. The Studio validates and compiles the selected set before it can be treated as a coherent game-content configuration.

This milestone intentionally establishes package contracts, validation, dependency resolution, and shared runtime control. It does not attempt to complete live tuning, production sprite tooling, or a full tracker DAW in one epoch.

## 2. Package schemas

`src/schemas/studioPackageSchema.ts` defines:

- package type and format identifiers;
- semantic versions;
- manifests;
- authors and licensing;
- engine compatibility;
- required and optional dependencies;
- declared external resources;
- Level Pack payloads;
- Tuning Pack payloads;
- Music Pack payloads;
- Asset Pack payloads;
- workspace locks.

Packages are data-only. Resource URIs must be relative paths or HTTP(S) URLs. Executable schemes are rejected.

## 3. Portable package codec

`PackageCodec` provides:

- custom-extension filenames;
- readable JSON serialization;
- schema parsing;
- semantic validation;
- stable canonical serialization;
- deterministic FNV-1a fingerprints.

Epoch 12 uses JSON envelopes rather than ZIP containers. Later packed and unpacked transports must preserve the same logical schemas.

## 4. Semantic validation

`PackageValidation` detects:

- duplicate dependency declarations;
- duplicate content IDs;
- incomplete Level Package v2 references;
- invalid campaign level order;
- missing Music Pack cues/resources;
- invalid sample-instrument resources;
- undeclared Asset Pack resources;
- invalid shadow-asset references;
- unsafe resource URI schemes.

Validation occurs before imported package data becomes active.

## 5. Dependency resolution

`DependencyResolver` supports:

- exact versions;
- `>=` minimum versions;
- `^` compatible-major ranges;
- optional dependencies;
- missing-package errors;
- version mismatches;
- duplicate packages;
- dependency-cycle detection;
- deterministic dependency order.

The Level Pack depends on the selected tuning, music, and asset packages. The other package types do not depend on levels.

## 6. Content compiler

`ContentCompiler` consumes the workspace and loaded packages. It validates:

- one package of every required type;
- package semantics;
- workspace pins;
- dependencies;
- duplicate runtime content IDs;
- level-to-music references;
- enemy-to-asset references;
- equipment icon references;
- active level existence.

Successful compilation produces a deterministic `skyforge-compiled-content` manifest containing package order, content IDs, the active level, and a fingerprint.

The Epoch 12 compiler validates and describes the build. Epoch 16 subsequently added locked resource copying, live/dead analysis, content-addressed output, and release manifests. Atlas rendering remains an Asset Studio operation, and music rendering remains a Music Studio operation.

## 7. Studio shell

`/studio.html` loads the React Game Design Studio.

### Level workspace

- Embeds the complete Epoch 11 Level Studio.
- Sends the unsaved working project to the parent Studio.
- Converts it into a portable `.sflevelpack`.
- Loads a compatible Level Pack back into the editor.
- Retains spatial, timeline, validation, preview, undo/redo, and Level Package v2 workflows.

### Tuning workspace

- Browses enemy definitions.
- Edits health, speed, and credit values.
- Edits easy/normal/hard difficulty multipliers.
- Persists edits in the active package.
- Exports `.sftuning`.

Live runtime hot reload and telemetry are deliberately deferred to Epoch 13.

### Music workspace

- Browses adaptive cues.
- Plays the rendered full mix.
- Displays stem resource references.
- Displays FM instrument metadata.
- Edits cue/source BPM metadata.
- Exports `.sfmusic`.

Changing metadata does not time-stretch existing audio. Full tracker composition is Epoch 15.

### Asset workspace

- Browses semantic asset definitions.
- Displays roles and asset types.
- Previews altitude and shadow separation.
- Edits altitude and shadow offsets.
- Displays tileset counts.
- Exports `.sfassetpack`.

Production image import and atlas tooling are Epoch 14.

### Build workspace

- Displays all four selected packages.
- Displays versions, dependencies, and resources.
- Runs the compiler automatically.
- Displays errors and warnings.
- Exports the compiled manifest.
- Exports the workspace and all four packages separately.

## 8. Shared runtime bridge

The Studio embeds the same game entry point used by normal play.

The parent Studio can send:

- pause;
- resume;
- restart;
- seek;
- time scale;
- invulnerability.

The runtime reports:

- active level;
- level time;
- active scene state;
- pause state;
- music debug state.

`GameScene.studioSeekTo()` uses the existing Level Timeline seek path. This is suitable for the Epoch 12 foundation. Epoch 13 replaces approximate arbitrary seeking with periodic deterministic snapshots and replay.

## 9. Persistence

The browser stores:

- the current `.sfworkspace` data;
- the four active package working copies.

Every stored package is revalidated on load. Invalid or outdated stored data falls back to built-in packages.

## 10. Built-in packages

`BuiltInPackages` adapts the current content registry into the four package formats:

- all current levels and terrain documents;
- the complete combat/equipment tuning set;
- adaptive music cues, resources, and initial FM instrument metadata;
- semantic placeholder assets and procedural terrain tilesets.

These packages allow the Studio and compiler to operate immediately without changing the existing game content-loading path.

The generated package set, workspace lock, and compiled manifest are included in `examples/studio-packages/`.

## 11. Testing

Added unit coverage verifies:

- all four built-in packages validate;
- the workspace validates;
- each package round-trips through serialization;
- dependencies resolve in order;
- compilation is deterministic;
- missing dependencies block compilation;
- version-range handling;
- fingerprint stability;
- duplicate semantic IDs are rejected;
- unsafe resource URIs are rejected.

The Playwright suite adds a Studio smoke scenario checking:

- Studio page load;
- five workspace tabs;
- embedded Level Studio;
- four package cards;
- successful built-in compilation.

## 12. Manual tester workflow

1. Run `npm ci` and `npm run dev`.
2. Open `/studio.html`.
3. Modify a level in the embedded Level Studio.
4. Select **Capture Working Copy**.
5. Export the Level Pack.
6. Modify enemy or difficulty values and export the Tuning Pack.
7. Preview music and export the Music Pack.
8. Adjust an asset shadow and export the Asset Pack.
9. Open Build and confirm `Compile OK`.
10. Export the compiled manifest, workspace, and four packages.
11. Re-import the five authoring files.
12. Start the shared runtime and test pause, resume, restart, and seek.

## 13. Known limitations

- Package resources are referenced rather than embedded.
- The base game still loads its built-in JSON through `ContentRegistry`; the production package-to-build compiler is Epoch 16.
- Tuning edits are not hot-applied to live entities yet.
- Timeline seek uses the existing reconstruction path rather than full periodic snapshots.
- Asset previews use semantic placeholders rather than imported production images.
- Music editing is metadata and playback only; tracker sequencing/rendering is not implemented.
- Real-time multi-user editing is not implemented.
- The main Phaser bundle remains larger than the desired final release target.

## 14. Next epoch

Epoch 13 should implement the Simulation and Tuning Lab:

- schema-generated controls;
- safe runtime overrides;
- isolated simulations;
- video-style transport;
- periodic deterministic snapshots;
- seek and replay;
- attention markers;
- telemetry and A/B comparison.
