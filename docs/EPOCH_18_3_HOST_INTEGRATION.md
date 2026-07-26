# Epoch 18.3 Host Integration Guide

The feature modules are intentionally isolated under `src/features/levelMusic`. Integrate them into the real Epoch 18.2 host in the following order.

## 1. Level schema

Extend the existing `music` object rather than replacing it. Add optional/defaulted fields:

```ts
trackId: safeIdSchema.nullable().default(null),
loop: z.boolean().default(true),
volume: z.number().min(0).max(1).default(0.8),
startOffsetSeconds: z.number().min(0).max(86_400).default(0),
fadeSeconds: z.number().min(0).max(10).default(1),
```

Preserve legacy cue/stinger fields. Add fixtures for a legacy level, a silent level, and a single-track level.

See `docs/epoch18.3-level-music-snippets/01-level-schema.md`.

## 2. Music resource/package schema

Permit `audio/mpeg` only in the audio resource branch. Continue rejecting HTML, JavaScript, SVG, WebAssembly, shader, and executable URI content. Store hash, byte count, provenance source, and imported timestamp.

The existing Music Pack remains the package dependency boundary. Do not add a fifth workspace package.

## 3. Workspace store and persistence

Add a registry to the active Music Pack or its folder representation. Persist MP3 bytes using the same binary-resource mechanism already used for audio-bearing Music Packs. In folder mode, materialize them under `assets/audio/music/` or map that stable logical path into the existing `resources/` directory.

Deduplicate identical bytes by SHA-256. Never persist an original absolute user path.

## 4. Level workspace UI

Mount `LevelMusicPanel` beneath the selected level’s mission settings. Keep it outside the map canvas and timeline pointer handlers.

Required callbacks:

- `onImportMp3`: call `importMp3File`, persist bytes, upsert registry, assign returned ID.
- `onChange`: update the active level immutably through the existing package mutation/history path.
- `onPreview`: use a Studio-only audio element with deterministic object-URL cleanup.
- `onStopPreview`: stop and revoke preview resources.
- `onRevealFolder`: Electron/folder-mode only; no-op or omit in browser-only mode.
- `onRemoveTrack`: reject or confirm when references remain.

See `02-level-workspace.md`.

## 5. Editor bridge

The Level workspace is iframe-coupled in the accepted architecture. Extend the typed message contract with assignment and preview messages; do not pass raw MP3 bytes repeatedly through `postMessage`. Pass an immutable package/resource reference or a one-use object URL under existing origin checks.

## 6. Runtime

Single-track runtime cues are owned exclusively by the existing `MusicDirector` and shared `AudioManager` bus.

At level load:

1. Resolve `trackId` through the compiled music registry.
2. Verify the resource is present.
3. Start only after the AudioManager unlock gate.
4. Apply music-bus gain × per-level volume.
5. Stop/fade on level transition, abandonment, restart, and scene shutdown.
6. Continue silently on a recoverable missing/decode error.

See `03-runtime.md`.

## 7. Validation and production compiler

Add the registry/assignments to package semantic validation. Feed all exported level assignments to `selectLiveMusicAssets`. Copy only returned MP3s to release resources, verify hash/length, and record referring levels in the release manifest.

See `04-production-compiler.md`.

## 8. Folder project and Electron

Folder mode must round-trip MP3 bytes byte-for-byte. Electron import should copy into the project, never retain a security-scoped or absolute source path. Reveal-folder must resolve only the configured project music directory.

## 9. Tests

Add:

- pure helper tests from this kit;
- component test for import/select/no-music/missing-warning;
- Music Pack round-trip with a small MP3 fixture;
- package validation hash/length/path traversal cases;
- production compiler live/dead resource cases;
- runtime lifecycle test for play/pause/resume/restart/cleanup;
- E2E import/select/save/reload/export flow.

## 10. Required commands

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run level-music:verify -- --project .
```

Do not issue an Epoch 18.3 acceptance package until these have run against the actual rebased source tree.
