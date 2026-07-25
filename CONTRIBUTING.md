# Contributing to Skyforge

Skyforge uses asynchronous, package-based collaboration. Contributors normally work on one of four content packages rather than changing the game runtime directly:

- `.sflevelpack` — levels, terrain, collision, routes, objects, encounters and campaign order;
- `.sftuning` — enemies, weapons, movement, encounters, difficulty, pickups and equipment;
- `.sfmusic` — cues, tracker source, instruments, adaptive mixes and rendered audio;
- `.sfassetpack` — sprites, animation, pivots, collision previews, hardpoints, tilesets and atlases.

A `.sfworkspace` pins one package of each type. A `.sflock` pins exact versions, content revisions, fingerprints and resource hashes.

## Required tools

- Node.js 22 LTS
- npm
- Git
- Playwright Chromium and WebKit for browser/device validation

```bash
npm ci
npx playwright install chromium webkit
```

## Git-friendly package workflow

Portable package files are useful for exchange. Unpacked folders are better for code review and merging.

```bash
npm run studio:unpack -- examples/studio-packages/skyforge-base-levels-1.0.0.sflevelpack ./work/levels
# edit files under ./work/levels/payload/
npm run studio:pack -- ./work/levels ./out/my-levels-1.0.1.sflevelpack
```

The unpacked representation contains:

```text
skyforge.package.json
payload/index.json
payload/<content-group>/<stable-id>.json
resources/index.json
resources/<binary files>
```

Do not rename stable IDs merely to reorder files. `payload/index.json` preserves authored ordering.

## Lock and release validation

After selecting the four packages in a workspace, create a dependency lock:

```bash
npm run studio:lock -- \
  examples/studio-packages/skyforge-main-workspace.sfworkspace \
  examples/studio-packages \
  examples/studio-packages/skyforge-main-workspace.sflock
```

Compile a release package:

```bash
npm run studio:compile -- \
  examples/studio-packages/skyforge-main-workspace.sfworkspace \
  examples/studio-packages \
  examples/studio-packages/skyforge-main-workspace.sflock \
  ./release-content \
  ./public
```

Compilation fails when packages drift from the lock, required dependencies are missing, a resource hash differs, or a blocking review comment remains open.

## Review comments

Package schema v2 stores review comments in the package. Comments have:

- stable ID;
- author;
- JSON-pointer-style target path;
- note, suggestion or blocking severity;
- open or resolved status.

Blocking comments prevent production compilation until resolved.

## Pull-request expectations

Before opening a pull request:

```bash
npm run audit:release
npx playwright test
```

Include:

1. the package or runtime area changed;
2. migration impact;
3. validation and test results;
4. screenshots or short recordings for visual changes;
5. licensing/provenance for new image or audio resources;
6. updated package lock and release manifest when content changes.

Do not commit `node_modules`, Playwright browser caches, local IndexedDB data, or unlicensed third-party assets.
