# Skyforge Epoch 17.5 — Runtime Refactor Implementation Report

**Release:** 0.8.5  
**Date:** 2026-07-13  
**Baseline:** Epoch 17.4

## Purpose

Epoch 17.5 addresses the principal architectural debt carried since the Epoch 9 review: `GameScene` had grown from 688 lines to 1,682 lines and combined scene composition, combat pools, boss lifecycle, economy/session state, mission settlement, presentation effects, Studio simulation, diagnostics, and input support.

The release preserves behavior while moving those responsibilities behind explicit controllers with lifecycle ownership and regression tests.

## Architecture before and after

| Measure | Epoch 17.4 | Epoch 17.5 | Change |
|---|---:|---:|---:|
| `GameScene.ts` lines | 1,682 | 635 | −62.2% |
| `GameScene.ts` imports | 45 | 38 | −15.6% |
| Production import cycles | 1 | 0 | eliminated |
| Vitest tests | 359 | 372 | +13 |
| Vitest files | 49 | 56 | +7 |

`GameScene` is now the composition root for:

- `CombatDirector` — actor pools, weapons, collisions, formations, encounters and spawn helpers.
- `BossController` — boss entity, both projectile overlaps, replacement, phase progression and cleanup.
- `RunProgressionController` — session state, loadout snapshot, mission economy, deterministic reward IDs and drop RNG.
- `MissionFlowController` — checkpoints, pause/retry, death, boss outcomes, settlement and results transition.
- `GamePresentation` — particles, damage feedback, pickup feedback and level-intro presentation.
- `StudioRuntimeController` — Studio arenas, snapshots, seeking, telemetry sampling and asset/music/tuning previews.
- `GameDebugController` — owned debug overlay, keyboard callbacks and key capture lifecycle.

## Correctness fixes discovered during refactor

### Boss lifecycle ownership

The prior scene stored only the player-bullet overlap. The missile overlap was created without retaining its handle and therefore could not be explicitly destroyed. Replacing a boss destroyed only its visuals, leaving object/collider lifecycle ambiguous.

`BossController` now:

1. destroys an existing boss before replacement;
2. retains both player-bullet and missile overlap handles;
3. destroys every overlap during replacement, defeat and shutdown;
4. destroys the boss object and visual children after defeat.

### Debug callback accumulation

Debug keyboard callbacks were registered on every scene start, while shutdown destroyed only the overlay. Repeated retries could accumulate handlers. `GameDebugController.destroy()` now unregisters each exact callback and releases captured function keys.

### Stale asset-preview race

A delayed texture load could previously draw an older Asset Studio preview after a newer request—or after the preview was closed. A monotonically increasing preview generation now invalidates stale loader completions.

### Package dependency cycle

`PackageCodec` imported semantic validation while `PackageValidation` imported `packageTypeOf` from the codec. `packageTypeOf` now lives in the neutral `PackageTypes` module. An import-graph regression test requires the production graph to remain acyclic.

### Per-frame device detection

Touch capability is now resolved once during scene creation instead of calling `isTouchDevice()` during every frame update.

## Compatibility

No package schema, save schema, level format, tileset manifest, collaboration format or public Studio bridge command changed. Epoch 17.4 projects and package examples remain valid.

## New architecture gates

- `GameScene` must remain at or below 675 lines.
- `GameScene` may not directly instantiate `Boss`, `PoolManager`, `WeaponSystem`, `MissionEconomy`, or `StudioSimulationRuntime`.
- Both boss projectile colliders must remain owned and destroyed.
- Debug callbacks must be detached on shutdown.
- Stale Asset Studio texture loads must be generation-gated.
- The production TypeScript/TSX import graph must contain no cycle.
