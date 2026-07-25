# Epoch 18.2 — Verified Blob-47 Geometry — 2026-07-14

### Corrected

- Rejected the Epoch 18.1 visual score after confirming that its tests validated mask presence but not perceptual inner-curve or diagonal legibility.
- Replaced the small-notch Blob templates with supersampled scalar-field geometry, producing broad concave corners with an 8–9 pixel gameplay-scale radius.
- Implemented four true 45-degree full-tile diagonal bank states.
- Changed shoreline rendering so lips, cliff faces, shallow fringes, and shadows are generated only from genuinely exposed contours; connected tile borders no longer receive internal cliff bands.
- Re-authored the opening and a mid-level section with uninterrupted one-cell-per-row diagonal transitions in both directions on both banks.
- Advanced the application version to 0.10.2.

### Deficiency-specific verification

- Added 52 diagonal-bit perceptual-difference checks.
- Added full-tile slope and R² tests for all four diagonal orientations.
- Added minimum-radius and non-linearity tests for all four inner-corner orientations.
- Added playable-map tests for sustained diagonals and required mask frequency in the opening.
- Added deterministic gameplay-scale geometry evidence output.
- Passed 376 tests across 55 files, strict TypeScript, ESLint, texture verification, and the revised 8.70/10 internal benchmark audit.

# Epoch 18.1 — Benchmark-Audited Canyon Environment — 2026-07-14

### Changed

- Iterated the canyon artwork and map composition through a closed benchmark audit against the visual principles demonstrated by Raptor: Call of the Shadows, Tyrian, and Major Stryker.
- Expanded water and sandstone source planes from 256×256 to 512×512 to further suppress repeat cadence.
- Added four deterministic visual variants for every canonical Blob-47 sandstone-boundary and shoreline mask.
- Expanded cracks, scrub, sediment, ruins, platforms, and source-art prop coverage.
- Added shoreline stations, docks, a canal bridge, bank compounds, island ruins, and recurring late-level outposts so recognisable environment beats begin immediately and recur throughout the mission.
- Updated Asset Studio metadata, package folders, dependency lock, and compiled release resources to the final 480-frame terrain atlas and 512px plane sources.
- Advanced the application version to 0.10.1.

### Benchmark gate

- Final structured internal art-direction score: **8.76/10**, exceeding the required **8.50/10** threshold.
- The score is supported by exact texture-wrap checks, directional-energy limits, one-tile and metatile repetition measurements, 47-mask/four-variant coverage, geological component checks, map-shape range checks, landmark-spacing checks, palette separation, and player-shadow lifecycle checks.

### Verification

- Passed 375 tests across 55 files, strict TypeScript, ESLint, texture verification, benchmark audit, root and `/skyforge/` production builds, bundle budgets, 11-resource example compilation, portable dependency-lock validation, and a zero-vulnerability npm audit.
- Browser rendering remains uncertified in the audit environment because the pinned Playwright browser binaries are unavailable.

# Epoch 18 — Authored Canyon Environment — 2026-07-14

### Changed

- Replaced the high-energy diagonal water treatment with three quiet, exactly seamless 256×256 frames and slower synchronized animation.
- Replaced the repeating sandstone metatile with one seamless 256×256 source composited through per-chunk Blob-47 alpha masks.
- Simplified the 47 shoreline frames to a thin cliff lip and continuous undercut, removing repeated cave-like cavities from the core transition set.
- Added deterministic geological cleanup for small holes, one-cell spurs, fragile necks, and undersized components.
- Re-authored Canyon Passage around broad bends, controlled pinches, four substantial islands, open combat basins, and landmark zones.
- Added independent sediment, rock-cluster, crack, scrub, ruin, and platform layers with sparse placement rules.
- Refined the player shadow into a closer, wider, layered ship silhouette.
- Advanced the application version to 0.10.0.

### Verification

- Added water gradient-balance checks, exact water/sandstone seam checks, sandstone repetition limits, shoreline transparency limits, geological component checks, and decoration-density checks.
- Passed 375 tests across 55 files, strict TypeScript, ESLint, root and `/skyforge/` builds, bundle budgets, 11-resource example compilation, portable-lock validation, and a zero-vulnerability dependency audit.
- Playwright retained 16 configured browser executions, but browser binaries were unavailable in the audit environment; browser execution remains uncertified.

# Epoch 17.9 — Continuous Terrain and Blob-47 Presentation — 2026-07-14

### Changed

- Replaced 13,600 explicit river cells with one world-aligned animated Phaser `TileSprite` plane.
- Added two exactly seamless 128×128 water animation frames with one synchronized world phase.
- Separated sandstone interior fill, Blob-47 boundary topology, and transparent shoreline/undercut overlays.
- Added coordinated 128×128 sandstone metatile rendering to hide the former 32-pixel interior cadence.
- Rebuilt the opening canyon demonstration with S-bends, bays, pinches, peninsulas, and multiple islands.
- Replaced the generic player ellipse with a dedicated offset, flattened ship-shadow texture.
- Reduced Canyon Passage from 21,343 to 8,047 explicit cells and reduced its JSON by 61.2%.
- Advanced the application version to 0.9.1.

### Verification

- Added exact wrap tests for water and sandstone, complete Blob-47 mapping validation, plane-rendering tests, and player-shadow lifecycle coverage.
- Passed 374 tests across 55 files, strict TypeScript, ESLint, bundle budgets, root/subpath builds, example compilation, and a zero-vulnerability dependency audit.
- Browser automation remains uncertified because the audit environment lacks the pinned Playwright Chromium binary.

# Epoch 17.7 — Connected Canyon and visual-only terrain — 2026-07-13

### Changed

- Removed terrain collision from the active game runtime: cliffs no longer clamp or damage the player, and terrain no longer blocks player or enemy projectiles.
- Removed the Collision tool from the active Level Studio workflow while retaining a non-blocking corridor guide for future analysis and redesign.
- Removed the default canyon gate, barrier, and terrain-state events from Level 01.
- Rebuilt Canyon Passage as a full-mission 800-row authored level covering the complete 250-second scroll profile.
- Replaced randomly stamped cliff visuals with deterministic Cardinal-16 connected cliff masks and matching shoreline-rim masks.
- Changed the river to a full-width, world-aligned base layer at scroll ratio 1, eliminating black seams and parallax separation from the walls.
- Limited river animation to two clean water frames so rock/stamp frames can no longer appear as floating debris.
- Added exterior-aware adjacency generation and automatic rim regeneration in the Level Studio autotile action.
- Advanced the application version to 0.9.0.

### Verification

- Added structural tests for visual-only TerrainRuntime behavior, full-map river coverage, exact cliff/rim adjacency, clean river frames, and non-blocking default terrain data.
- Regenerated built-in packages, Git-folder examples, dependency lock, and compiled release resources from the revised level and atlas.

# Epoch 17.6.2 — AI-Free Focused Studio

- Confirmed there are no OpenAI SDKs, AI SDKs, model clients, or provider modules in dependencies or devDependencies.
- Removed the retired Asset Foundry brief, generation-job, candidate, processing-recipe, runtime-test, and assignment-proposal schemas.
- Removed Foundry-only validation and folder serialization paths.
- Reduced Asset Pack payloads to assets, tilesets, and atlases.
- Reworded demonstration-asset provenance as externally generated artwork; runtime image files are unchanged.
- Generalized the portable-lock guard to reject internal registry hosts without vendor-specific coupling.

# Changelog

## Epoch 17.6.1 — Portable dependency-lock hotfix — 2026-07-13

### Fixed

- Replaced 81 environment-specific OpenAI Artifactory tarball URLs in `package-lock.json` with portable `registry.npmjs.org` URLs.
- Added an explicit release check that rejects internal registry hosts before packaging.
- Preserved all dependency versions and integrity hashes; no application code or runtime behavior changed from Epoch 17.6.

### Verification

- Lockfile JSON parses successfully and remains synchronized with `package.json`.
- No `internal.api.openai.org` or `applied-caas-gateway` references remain in the release tree.
- A clean offline `npm ci` succeeds against the cached package set, confirming the corrected lockfile is installable without the internal mirror.

## Epoch 17.5 — Runtime decomposition, QA audit and optimization review — 2026-07-13

### Added

- Focused `CombatDirector`, `BossController`, `RunProgressionController`, `MissionFlowController`, `GamePresentation`, `StudioRuntimeController`, and owned diagnostics controller.
- Architectural regression budgets for `GameScene`, boss collider ownership, Studio preview lifecycle, debug callback cleanup, and a cycle-free production import graph.
- Independent-style QA audit, deficiency register, verification report, and prioritized optimization roadmap.

### Changed

- `GameScene` reduced from 1,682 lines and 45 imports to 635 lines and 38 imports; it is now a composition root rather than the owner of every runtime subsystem.
- Project version advanced to 0.8.5.
- Package type classification moved to a neutral module to remove the `PackageCodec` ↔ `PackageValidation` dependency cycle.
- Touch-device detection is cached once per scene instead of recalculated every frame.

### Fixed

- Both player-bullet and missile boss overlaps are retained and destroyed deterministically.
- Replacing or defeating a boss now destroys the previous boss object, visuals, and collider handles.
- Debug keyboard callbacks and captured keys are removed during scene shutdown.
- Stale asynchronous Asset Studio preview loads can no longer overwrite a newer preview or reopen a dismissed preview.

### Verification

- 372 Vitest tests across 56 files, strict TypeScript, ESLint, production builds, bundle budgets, package compilation, cycle check, and zero-vulnerability dependency audit pass.
- The 17 Playwright project executions are present; this environment blocks browser access to loopback with `ERR_BLOCKED_BY_ADMINISTRATOR`, so browser execution remains a documented external verification requirement.

## Epoch 17.4 — Default image-backed canyon tileset — 2026-07-13

### Added

- Reproducible Pillow pipeline that converts the retained generated source master into strict terrain and props atlases.
- 512×256 terrain atlas with 128 exact 32×32 frames and a 512×128, 64-frame props atlas.
- Validated biome tileset metadata, deterministic frame resolution and full Cardinal-16 cliff mapping.
- Image-backed Level Studio canvas rendering, animated water previews and atlas thumbnails in the material browser.
- Phaser spritesheet preloading and chunked atlas-backed terrain rendering with procedural fallback.
- Default metal-platform demonstration cells in Canyon Passage.
- Built-in Asset Pack resources and tileset definitions matching the editor and runtime assets.
- PNG/hash, schema, frame-resolution, React canvas and browser-smoke coverage.

### Changed

- Project version advanced to 0.8.4.
- Logical map cells remain authoritative while visual atlas frames are derived deterministically.
- Collaboration examples, dependency lock and compiled release example now reference the normalized canyon resources.

### Deferred

- Automatic gated Blob-47 mapping, true half-tile dual-grid transitions and the props/stamp palette remain the next autotiling revision.

## Epoch 17.3 — Level Studio UX redesign — 2026-07-13

### Added

- Canvas-first Level Studio layout with collapsible resource and inspector docks.
- Default Select tool, direct object hit-testing, selected-object outlines and drag manipulation.
- Stroke transactions so one pointer drag creates one undo entry.
- Wheel and Space-drag map navigation, modifier-wheel zoom, fit/start/end/page controls and a full-level minimap.
- Searchable visual material browser with swatches, recent materials and tile sampling.
- Contextual Selection, Layer and Analysis inspectors with actionable route issues.
- Mode-sensitive collision, route and object overlays.
- Lane-based timeline with draggable events and a visible playhead.
- Embedded Level Studio compact mode and optional hidden runtime dock for maximum canvas width.
- Component and pure tests for stroke transactions, minimap mapping and object hit-testing.

### Changed

- Project version advanced to 0.8.3.
- Embedded Level Studio removes duplicate export/navigation controls while preserving undo, redo and validation.
- Runtime visibility can be toggled from the main Studio toolbar.

## Epoch 17 — AI Asset Foundry — 2026-07-12

### Added

- Structured Asset Studio briefs, prompt-template versions, generation jobs and candidate lineage.
- Secure loopback OpenAI image gateway using environment-only credentials.
- Manual ChatGPT-output import with identical lineage records.
- GPT Image generation/edit contracts with high-fidelity image references.
- Non-destructive matte removal, subject cropping, sprite resizing, alpha threshold and palette reduction.
- Runtime test reports, approval gates and mobile/collision/hardpoint/shadow review warnings.
- Transactional enemy sprite and equipment icon assignment proposals.
- Git-folder serialization and semantic validation for every Foundry authoring record.
- Built-in completed Foundry example and 290-test release suite.

### Changed

- Asset Studio opens on the Foundry workflow before conventional asset editing.
- Asset Pack resources also accept verified JPEG source candidates; runtime derivatives remain PNG-oriented.
- Release audit checks the local gateway scripts.
- Project version advanced to 0.8.0.

### Security

- API keys are excluded from browser code and package data.
- Gateway binds to loopback, validates origins and fixed request contracts, caps request size and image count, and applies timeouts.
- Generated and imported resources remain data-only and hash/byte verified.

### Known limitations

- Paid API generation was not exercised in the release environment because no API key was configured.
- Advanced frame consistency, onion skinning, palette libraries, automatic shadows and batch queues remain future refinements.

## 0.7.0 — Epoch 16 Collaboration and Production Compiler — 2026-07-12

- Migrated Studio packages and workspaces to schema v2 with content revisions and review comments.
- Added automatic schema-v1 import and local-storage migration.
- Added deterministic `.sflock` creation and drift validation.
- Added note, suggestion and blocking review comments; blocking comments gate release compilation.
- Added deterministic package diffs and Markdown review reports.
- Added Git-friendly folder unpack/repack with stable per-item JSON, explicit order indexes, and binary resources.
- Added browser and Node production compilers with live-resource analysis, byte/hash verification, content-addressed output and dead-resource removal.
- Added checked-in packed, unpacked, locked and compiled collaboration examples.
- Added Vite manual chunks and enforceable production build budgets.
- Added desktop Chromium, Pixel 7 Chromium and iPhone 14 WebKit Playwright projects.
- Added contributor, package-authoring, device-QA, pull-request and content-issue templates.
- Updated PDR, roadmap, architecture, README and verification documents.

## 0.6.0 — Epoch 15: Tracker/FM Music Studio — 2026-07-12

### Added

- Tracker pattern/order editor with notes, instruments, velocity, duration, effects, swing, loop order, and quantization.
- FM instrument editor and on-screen audition keyboard.
- Sample-instrument imports for WAV, OGG, MP3, and M4A.
- Adaptive-state gain and transition authoring.
- Runtime-synchronized package preview.
- Deterministic FM stem/full-mix rendering, WAV output, and loop analysis.
- IndexedDB persistence and audio resource verification.
- Updated built-in source, collaboration example, tests, and post-epoch audit.

### Changed

- `.sfmusic` schemas now carry full channel, pattern, event, instrument, transition, and render-resource metadata.
- The Music tab is an authoring environment rather than a metadata browser.
- `MusicDirector` supports cue offset and initial adaptive state.
- Package version advanced to 0.6.0.

### Known limitations

- Deterministic sample decoding, Music-specific undo/redo, MIDI, render workers, and automatic crossfades remain production-hardening work. Epoch 16 later added folder transport and final release-resource hashing.

## 0.5.0 — Epoch 14: Asset Studio Production Workflow — 2026-07-12

### Added

- PNG/WebP resource import with SHA-256, byte-count, dimension, provenance, and licensing metadata.
- IndexedDB persistence for image-bearing working Asset Packs.
- Semantic asset classification and candidate/approved/rejected curation.
- Sprite-sheet slicing, named animation authoring, pivot, scale, collision preview, hardpoints, altitude, and shadow controls.
- Neutral, canyon, ice, space, station, and combat preview environments.
- Shared Phaser runtime asset-preview bridge.
- Tileset construction with cardinal, dual-grid, and Wang metadata.
- Deterministic atlas generation with stable frame keys and overlap validation.
- Missing, candidate, rejected, and unused asset-reference reporting against Tuning Packs.
- Immutable tuning-reference replacement proposals.
- Verified built-in fighter, shadow, and canyon-tileset demonstration resources.
- Asset Studio unit tests and Playwright workflow coverage.

### Changed

- `.sfassetpack` resources may carry verified embedded PNG/WebP data.
- Asset package schemas now include frames, animations, collision shapes, hardpoints, presentation data, tilesets, and atlases.
- The Studio Assets tab is now a complete authoring workspace rather than a metadata browser.
- The package version is now 0.5.0.

### Known limitations

- Epoch 16 later added unpacked Git resource folders and production resource compilation. Optional ZIP convenience transport remains future work.
- Polygon collision uses metadata entry rather than a full vector drawing tool.
- Runtime preview does not yet replace every placeholder entity rendering path.
- Final production art and device-level visual QA remain outstanding.

## 0.4.0 — Epoch 13: Simulation, Live Tuning & Timeline Transport — 2026-07-12

### Added

- Schema-generated live tuning controls for enemy, difficulty, projectile, movement, weapon, boss, and encounter data.
- Transient validated tuning overlays applied to the real embedded Phaser runtime.
- Full-level, enemy, weapon, formation, encounter, boss, route, and loadout simulation arenas.
- Video-style play, pause, step, restart, speed, loop, scrub, and attention-marker transport.
- Configurable periodic runtime snapshots and nearest-anchor seeking.
- Runtime reconstruction of player resources, terrain, enemy state, weapon timers, projectile pools, pickups, score, multiplier, and boss identity.
- Attention/intensity analysis, telemetry heatmap, A/B comparison, and Markdown tuning review exports.
- Lightweight snapshot indexes and bounded telemetry messaging between the runtime and Studio host.

### Changed

- Package version advanced to 0.4.0.
- `LevelTimeline` can advance its shared clock without firing authored events for isolated arenas.
- Multiplier, defense, energy, enemies, projectiles, pickups, and enemy weapons expose controlled reconstruction APIs.

### Limitations

- Snapshot transport is an authoring aid, not a deterministic replay certification format. Particle state, transient sounds, exact boss phase internals, and physics contact caches may reconstruct approximately.

## Epoch 12 — Game Design Studio Foundation — 2026-07-12

### Added

- A unified Game Design Studio at `/studio.html` with Level, Tuning, Music, Assets, and Build workspaces.
- Four independently validated, data-only package formats: `.sflevelpack`, `.sftuning`, `.sfmusic`, and `.sfassetpack`.
- `.sfworkspace` files that pin the active package IDs, versions, and level.
- Package manifests with semantic versions, authors, licenses, engine ranges, dependencies, tags, timestamps, and external resource metadata.
- Portable JSON package codec, deterministic serialization, and content fingerprints.
- Dependency resolution with missing-package, version-mismatch, duplicate, and cycle reporting.
- A cross-package compiler that validates level/music and tuning/asset references and emits a deterministic compiled-content manifest.
- Local persistence for the working workspace and package set.
- A Level Studio bridge that captures unsaved working data as a Level Pack and loads compatible Level Packs back into the Composer.
- A shared embedded Phaser runtime with start, restart, pause, resume, seek, invulnerability, and runtime-state reporting.
- Foundational Tuning controls for enemy and difficulty values.
- Foundational Music views for cue playback, BPM/source metadata, adaptive stems, and FM instruments.
- Foundational Asset views for semantic roles, altitude, shadows, collision metadata, and tilesets.
- Unit coverage for package schemas, codec round trips, dependency resolution, version ranges, compilation, and deterministic fingerprints.
- Playwright coverage for the Studio shell and built-in package compilation.
- A complete example package set, workspace lock, and compiled manifest in `examples/studio-packages/`.
- Governing `GAME_DESIGN_STUDIO_ARCHITECTURE.md` and approved `EPOCH_12_PDR_REVIEW.md`.

### Changed

- The PDR now defines a four-workspace Game Design Studio rather than a single expanding level editor.
- Epochs 12–16 are reorganized around Studio foundation, live simulation/tuning, Asset Studio, Music Studio, and collaboration/production compilation.
- Vite now builds three entry points: game, Level Studio, and Game Design Studio.
- The base-path verification script validates all three pages.
- The package version is now 0.3.0.

### Deferred by design

- Live tuning hot reload, telemetry comparisons, and deterministic snapshot replay are Epoch 13.
- Image import, sprite animation authoring, atlas packing, and portable binary resources are Epoch 14.
- Full tracker pattern editing, FM synthesis rendering, and level-synchronized music composition are Epoch 15.
- Unpacked Git mode, migrations, review workflows, and the production resource compiler are Epoch 16.

## Epoch 11 — Solid Terrain Runtime and Level Composer Expansion — 2026-07-12

### Added

- Level Package v2 schemas and validated content registries for maps, collision, routes, terrain objects, biomes, and package manifests.
- A 32px tile grid over a 544px internal map width with 17 columns and 16-row chunks.
- Chunked semantic parallax rendering for the Canyon Approach vertical slice.
- Authoritative corridor collision independent from map artwork.
- Swept player and projectile collision for canyon walls, gates, and barriers.
- Route clearance, largest-navigation-hull, reaction-time, and combined combat-pressure analysis.
- Timeline-controlled gates, destructible barriers, terrain rewards, and checkpoint/seek-safe terrain state.
- Cardinal adjacency variants and first-pass dual-grid natural boundary overlays.
- Spatial Level Composer with paint/erase/fill, zoom, layer visibility/lock/solo/order, collision/routes/objects modes, analysis, and navigation-hull preview.
- Stable editor event IDs, immutable undo/redo history, project autosave, and unsaved terrain preview overlays.
- Validated multi-file package import/export with incomplete-package rejection.
- Terrain timeline, checkpoint, collision, autotile, route, package round-trip, and editor-history tests.
- Playwright terrain gate-state and Composer canvas smoke coverage.

### Changed

- `level_01` is now Canyon Approach and references `level_01_canyon`.
- Level Timeline supports validated `terrainState` events.
- `RunSession` snapshots include dynamic terrain state.
- The editor is now branded and structured as the Skyforge Level Composer.
- The roadmap assigns Epoch 12 to production atlas, polygon collision, expanded autotiling, object authoring, and device QA.

### Known limitations

- Terrain visuals are procedural placeholders rather than final pixel-art atlases.
- Canyon collision uses an interpolated corridor; arbitrary polygon and edge-chain authoring is deferred.
- Object mode repositions existing objects but does not yet provide full create/delete/property forms.
- Cardinal/dual-grid autotiling is a foundation rather than a complete Blob-47 or industrial library.
- Physical iPhone/controller and cross-browser QA remain external requirements.

## Epoch 10 — Ship Configuration, Credits, Equipment and Progression — 2026-07-12

### Added

- Save v2 campaign profile with v1 migration, persistent credits, inventory, loadouts, progression, mission records, settlement IDs, and transaction ledger.
- Twenty-one validated equipment definitions across eight categories.
- Pure loadout validation, deterministic ship-stat calculation, and immutable runtime snapshots.
- Loadout-derived propulsion, shared energy, shield/armor defense, weapon energy costs, and expanded HUD.
- Functional Hangar with purchase, refund/resale, equip, upgrade, comparison, validation, and launch flows.
- Enemy, ground, boss, mission, and pickup credit rewards with checkpoint escrow and itemized Results.
- Tier-one progression unlocks after Mission 1.
- Tonal credit chains and purchase, upgrade, error, and unlock feedback.
- Deterministic reward-sequence and drop-RNG checkpoint state.
- Expanded unit/content coverage to 209 tests across 23 files.

### Changed

- Main flow now enters the Hangar before a mission and returns there after settlement.
- Game Over permits checkpoint retry, full restart, or abandonment to the Hangar.
- Enemy content accepts backward-compatible zero-credit defaults while authored content declares explicit rewards.
- E2E smoke flow now covers Menu → Hangar → Launch.

### Known limitations

- Physical iPhone/controller QA and Playwright execution require an external environment with Chromium installed.
- Final hangar art, equipment icons, additional missions, and campaign-scale economy balancing remain future work.
- Multi-utility-slot targeting is mechanically supported by hull data but uses the first slot in the placeholder Hangar UI.

## 2026-07-12 — Solid terrain navigation design update

### Documentation

- Added `SOLID_TERRAIN_NAVIGATION_AND_LEVEL_COMPOSER.md`.
- Reordered Epoch 11 around deterministic solid-terrain collision, route validation, and terrain-first Composer authoring.
- Updated the PDR, tuning guide, roadmap, and README.
- Added future-facing Epoch 10 contracts for ship navigation hulls and handling envelopes without pulling the full terrain implementation into the economy epoch.

## Epoch 9R + adaptive music — 2026-07-12

### Added

- Data-driven adaptive music cues and schema validation.
- Shared-clock `MusicDirector` with synchronized stems and adaptive intensity.
- Original FM/tracker-style demonstration cue and OGG stems.
- Pure intensity, mobile quality, and `RunSession` checkpoint models with unit tests.
- Reusable gamepad navigation for menu scenes.
- Semantic level validation and per-level editor autosave.
- Expanded telemetry and browser smoke coverage.
- GitHub Pages base-path verification.

### Fixed

- Enabled Phaser gamepad input.
- Preserved active runs across Pause → Settings → Pause.
- Deferred AudioContext creation until a valid user gesture.
- Applied touch sensitivity and prevented action buttons from moving the ship.
- Added explicit run-state and shutdown cleanup.
- Prevented preview data from mutating the canonical content registry.
- Blocked standard export of invalid level content.
- Corrected high-score result detection.
- Corrected root-absolute editor links for project-page hosting.
- Removed restart-related debug overlay listener accumulation.

### Known limitations

- Physical iPhone QA is still required.
- Final hangar, boss, stinger, and economy music has not been produced.
- Full bar-aligned cue-to-cue transition scheduling is deferred.
- `GameScene` decomposition and stable editor event IDs remain future refactors.

## Epoch 17.1 — Studio usability corrections

- Corrected Level Studio canvas editing with explicit pointer capture, reliable drag painting, hover-cell feedback, active layer/material status, and an eraser control.
- Automatically reveals a layer when it is painted and repairs stale layer/material selections after package changes.
- Corrected Simulation Runtime dock overflow at desktop widths.
- Added expanded and pop-out runtime preview modes.
- Added regression coverage for scaled map coordinate mapping, embedded painting, and runtime dock overflow.

## Epoch 17.2 — Security and reliability remediation

### Security

- Replaced unvalidated package-folder unpacking with schema-first, semantically validated tooling.
- Added canonical safe authored IDs and path-containment enforcement.
- Added malicious package, resource traversal, duplicate filename, and non-empty target regression tests.
- Added Foundry Host, Origin, session-token, rate-limit, and concurrency controls.
- Removed production mutable debug-handle exposure through `?studio=1`; embedded preview now uses a nonce handshake.

### Reliability

- Corrected shield recharge-delay overshoot at coarse update rates.
- Added 30/60/120 Hz energy and defense equivalence tests.
- Prevented repeat purchase from overwriting already-owned non-unique equipment.
- Added component coverage for Level map painting and Foundry token/brief workflows.
- Added offline provider request-contract verification and an opt-in live smoke test.

### Documentation and delivery

- Added independent-audit preservation, implementation, verification, and security-review reports.
- Corrected stale README evidence and relabelled the previous self-review as internal and superseded.
- Source handoff archives now exclude compiled output, dependencies, caches, coverage, and browser-test artifacts.
