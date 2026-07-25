# Skyforge Epoch 17.5 — Deficiency Report and Optimization Opportunities

## Severity summary

**High: 0 · Medium: 5 · Low: 6 · Information: 2**

The release is suitable for continued development. The Medium findings are engineering-health and release-assurance items rather than known exploitable security defects.

## DEF-17.5-01 — Studio application monolith and limited UI coverage — Medium

`StudioApp.tsx` is 1,530 lines, `AssetStudioWorkspace.tsx` is 1,246, and `MusicStudioWorkspace.tsx` is 999. Only 4 of 17 production TSX modules have direct component tests.

**Risk:** Changes to import/export, package replacement, tuning controls, Music Studio and Build workflows can regress without a focused component failure.

**Recommendation:** Split each workspace into state reducers, command services and panel components. Add component coverage for package import, lock drift, production compile errors, tracker editing, asset assignment and workspace persistence.

## DEF-17.5-02 — StudioRuntimeController is a new concentration point — Medium

The extraction reduced `GameScene`, but `StudioRuntimeController` is 749 lines and combines arena lifecycle, snapshot capture/restore, fast-forward simulation, overlay application and asset preview rendering.

**Recommendation:** Extract `StudioSnapshotEngine`, `StudioArenaController` and `AssetPreviewRenderer`. Keep the public facade but cap each implementation module near 300 lines.

## DEF-17.5-03 — Browser regression suite not executable in the audit environment — Medium

All 17 Playwright project executions fail before application code runs because the managed browser blocks loopback navigation. WebKit binaries are also absent.

**Recommendation:** Require green Chromium and WebKit jobs in CI before release; archive the HTML report as a release artifact. Add a release-manifest field recording the CI run identifier and status.

## DEF-17.5-04 — GameScene remains a high-fan-out composition root — Medium

At 635 lines and 38 imports, `GameScene` is greatly improved but still owns level/bootstrap construction, terrain preview loading, event binding and runtime telemetry coordination.

**Recommendation:** Extract `LevelRuntimeFactory` and `GameSceneEventBindings`. A practical next target is 350–450 lines and fewer than 25 imports without hiding dependencies behind a service locator.

## DEF-17.5-05 — Core runtime lacks a Phaser integration harness — Medium

Boss and Studio lifecycle regressions are protected partly by architecture/source tests because Phaser objects are difficult to instantiate in Node Vitest. Those tests prevent accidental removal of policies but do not prove collider behavior.

**Recommendation:** Add a minimal headless/browser Phaser harness that can create `BossController`, fire both projectile types, restart the scene repeatedly and assert collider/object counts.

## DEF-17.5-06 — Studio-only code increases the normal game bundle — Low

The refactor adds 6,474 raw JS bytes and 2,060 gzipped bytes versus the exact Epoch 17.4 baseline. Most of the increase is in the main application chunk.

**Recommendation:** Load Studio simulation/overlay support only for preview builds or dynamically import it after a validated Studio handshake. Preserve a small no-op bridge in ordinary play.

## DEF-17.5-07 — Large built-in package/data modules — Low

`BuiltInPackages.ts` is 1,099 lines and the `ContentRegistry` chunk is approximately 301 kB.

**Recommendation:** Generate built-in packages from validated JSON during build, emit campaign-specific content manifests and lazy-load level/campaign content rather than shipping all authoring data in the first gameplay chunk.

## DEF-17.5-08 — Package validation remains broad — Low

The codec/validation cycle is removed, but `PackageValidation.ts` is still approximately 471 lines with type-specific branches.

**Recommendation:** Split semantic validators by package type and compose them through a typed dispatch table. This will simplify ownership and targeted testing.

## DEF-17.5-09 — Runtime optimization is budget-based, not profiler-based — Low

Bundle budgets and telemetry counters pass, but there is no captured CPU/GPU profile for long terrain levels, dense projectile scenes or Studio hot reload.

**Recommendation:** Add repeatable performance scenes and collect p50/p95 frame time, active object counts, terrain chunk rebuild time, texture memory and garbage-collection pauses on desktop and mobile reference devices.

## DEF-17.5-10 — Autotile recomputation remains a future scaling concern — Low

The current Cardinal-16 path works, but Blob-47 and true dual-grid support will increase neighborhood work during painting.

**Recommendation:** Store logical terrain as authoritative data, batch a complete pointer stroke, track dirty bounds, and recalculate only the 3×3 or four dual-grid intersections affected by each edit.

## DEF-17.5-11 — Live Foundry provider smoke remains unexecuted — Low

Offline provider contract checks exist, but no paid live image call was made in this audit.

**Recommendation:** Execute the opt-in smoke test before declaring integrated generation generally available, and record model/endpoint/date without storing the key.

## INFO-17.5-12 — Import graph is now acyclic — Information

A previous `PackageCodec` ↔ `PackageValidation` cycle was removed. The new regression test scans all production TypeScript and TSX imports and fails on a cycle.

## INFO-17.5-13 — Main architectural debt is resolved — Information

The previously mandated `GameScene` decomposition is now substantially complete. Future runtime features should be added to the focused controllers rather than growing the scene again.

## Prioritized optimization roadmap

1. Make Playwright Chromium/WebKit a mandatory recorded release gate.
2. Split `StudioRuntimeController` and add Phaser lifecycle integration tests.
3. Decompose `StudioApp` and the Asset/Music workspaces with component coverage.
4. Dynamically exclude Studio-only runtime support from ordinary game sessions.
5. Generate built-in package data and lazy-load campaign content.
6. Add profiler-backed performance baselines before Blob-47/dual-grid terrain work.
