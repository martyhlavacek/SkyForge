# Skyforge Epoch 16 Implementation

**Version:** 0.7.0  
**Date:** 2026-07-12  
**Milestone:** Collaboration and Production Compiler

## Outcome

Epoch 16 completes the planned Game Design Studio foundation by converting the four package formats from editor-only exchange files into a reproducible collaboration and release pipeline.

The milestone adds schema migration, package content revisions, dependency locks, embedded review comments, Git-friendly folder projects, deterministic release compilation, dead-resource removal, content-addressed resource output, contributor templates, build budgets, and a desktop/mobile browser test matrix.

## Delivered systems

### Package schema v2 and migration

Studio packages and workspaces now use schema version 2. Package manifests include `contentRevision`; packages and workspaces include review-comment collections. The import path migrates schema-v1 files by adding these fields. Files from a newer unsupported schema are rejected.

Local storage automatically reads v1 keys, migrates them, and writes v2 state under new keys. Portable v1 package files remain importable.

### Dependency locks

A `.sflock` records:

- exact workspace identity and fingerprint;
- package type, ID and semantic version;
- package content revision and deterministic fingerprint;
- declared resource IDs, byte counts and available SHA-256 values;
- a lock fingerprint.

The Build workspace can export a lock. Production compilation verifies the selected workspace and package set against the lock and reports drift rather than silently accepting changed content.

### Review comments and deterministic change reports

Review comments are data-only package records with author, target path, body, severity and status. The Studio Build workspace can add and resolve comments. An open `blocking` comment prevents production compilation.

Pure comparison services generate deterministic JSON-path changes and Markdown review summaries while ignoring expected metadata-only changes such as `updatedAt` and `contentRevision`.

### Git-friendly folder mode

Every portable package can be unpacked into a repository-friendly folder:

```text
skyforge.package.json
payload/index.json
payload/<category>/<stable-id>.json
resources/index.json
resources/<binary files>
```

`payload/index.json` preserves authored ordering independently of filesystem order. Binary embedded resources become ordinary files. Repacking restores the portable package without changing content.

Commands:

```bash
npm run studio:unpack -- package.sfassetpack ./asset-pack
npm run studio:pack -- ./asset-pack package.sfassetpack
```

Checked-in examples under `examples/studio-folder/` demonstrate all four package types.

### Production compiler

The browser compiler and Node release compiler now:

1. validate the workspace and package set;
2. enforce the dependency lock;
3. reject unresolved blocking review comments;
4. calculate the resource live set from stable references;
5. omit dead resources;
6. decode or load each live resource;
7. verify declared byte counts and SHA-256 values;
8. hash every compiled resource;
9. assign a content-addressed output path;
10. emit sanitized package JSON without embedded base64;
11. emit a production release manifest.

The compiler preserves deterministic atlas metadata and compiled atlas resources. Atlas image composition remains an Asset Studio authoring responsibility, avoiding a second release-time packing algorithm.

CLI workflow:

```bash
npm run studio:lock -- workspace.sfworkspace ./packages workspace.sflock
npm run studio:compile -- workspace.sfworkspace ./packages workspace.sflock ./release ./public
```

A complete compiled example is checked in under `examples/compiled-release/`.

### Build and performance hardening

Vite now emits separate Phaser, React, Asset Studio, Music Studio and Simulation chunks. Production build budgets are enforced by `scripts/check-build-budget.mjs` and recorded in `dist/build-budget-report.json`.

Current budgets:

- 3.2 MB total uncompressed JavaScript;
- 900 KB total gzipped JavaScript;
- 500 KB CSS;
- 1.65 MB Phaser vendor chunk;
- 800 KB any other JavaScript chunk.

### Cross-browser and mobile matrix

Playwright now defines:

- desktop Chromium for the complete suite;
- Pixel 7 Chromium for mobile touch/layout checks;
- iPhone 14 WebKit for iPhone-class touch/layout checks.

The mobile suite verifies canvas fit, touch entry, frame progress, Studio layout, and production-compiler controls. CI installs Chromium and WebKit.

Physical controller, audio-route, thermal and long-session checks remain documented manual release gates because browser automation cannot reliably reproduce them.

### Contributor workflow

Epoch 16 adds:

- `CONTRIBUTING.md`;
- package authoring and collaboration guide;
- device/performance QA matrix;
- pull-request template;
- content-package issue template;
- packed and unpacked examples;
- locked campaign-scale release example.

## Primary files

```text
src/studio/PackageMigrations.ts
src/studio/DependencyLock.ts
src/studio/PackageReview.ts
src/studio/FolderProject.ts
src/studio/ProductionCompiler.ts
src/studio/Epoch16Production.test.ts
scripts/studio-folder.mjs
scripts/create-studio-lock.mjs
scripts/compile-studio-release.mjs
scripts/studio-release-lib.mjs
scripts/check-build-budget.mjs
```

## Acceptance status

- [x] v1 packages and workspaces migrate to schema v2.
- [x] future unsupported schema versions fail loudly.
- [x] lock creation is deterministic for fixed inputs.
- [x] lock drift is detected.
- [x] all four package types round-trip through folder mode.
- [x] authored ordering survives folder round-trip.
- [x] binary resources survive folder round-trip.
- [x] package changes and review reports are deterministic.
- [x] unresolved blocking comments stop production compilation.
- [x] live resources are hashed and copied to content-addressed paths.
- [x] dead resources are reported and excluded.
- [x] campaign-scale examples compile under a checked lock.
- [x] Vite chunks are split and measured against release budgets.
- [x] desktop Chromium and mobile Chromium/WebKit projects are configured.
- [x] contributor and package-authoring documentation is included.

## Known limitations

1. Packed packages remain JSON envelopes rather than ZIP containers. The unpacked folder representation solves Git collaboration and binary-resource size, while ZIP transport remains an optional convenience feature.
2. Three-way semantic merge is not automatic. Stable IDs, per-item files, order indexes and deterministic change reports reduce conflict scope, but simultaneous edits to one item require human review.
3. Release compilation copies existing atlas resources; it does not re-render atlas pixels.
4. Sample-based music rendering remains non-deterministic across browser codecs and is still preserved rather than synthesized by the FM renderer.
5. Full physical-device QA requires access to actual iPhone, Android and controller hardware.
6. Real-time multi-user collaboration remains intentionally out of scope.
