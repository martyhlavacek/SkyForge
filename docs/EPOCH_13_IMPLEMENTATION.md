# Skyforge Epoch 13 Implementation

## Simulation, Live Tuning, and Timeline Transport

**Status:** Implemented  
**Package version:** 0.4.0  
**Date:** 2026-07-12

## 1. Scope

Epoch 13 turns the Epoch 12 Game Design Studio foundation into a usable simulation and balance laboratory. The Studio continues to use four independently versioned, data-only packages and embeds the same Phaser runtime used by the playable game.

The milestone implements:

- schema-generated tuning controls;
- transient live tuning overlays;
- eight isolated simulation scopes;
- video-style timeline transport;
- periodic snapshot-assisted seeking;
- automated attention markers;
- telemetry heatmaps;
- A/B comparison;
- tuning review reports.

No separate editor-only combat simulation was introduced.

## 2. Studio simulation scopes

The Tuning workspace can configure the shared runtime as:

| Scope     | Behaviour                                                      |
| --------- | -------------------------------------------------------------- |
| Level     | Runs the complete authored level timeline                      |
| Enemy     | Spawns one selected enemy definition                           |
| Weapon    | Equips a selected player weapon and supplies static targets    |
| Formation | Spawns a selected formation                                    |
| Encounter | Runs one selected encounter                                    |
| Boss      | Starts one selected boss                                       |
| Route     | Runs the terrain corridor without authored enemy events        |
| Loadout   | Exercises the active ship loadout against static heavy targets |

Each arena supports repeat, reset delay, and optional automatic primary fire. Observation invulnerability is enabled for Studio simulations.

## 3. Live tuning architecture

### 3.1 Generated controls

`TunableParameters.ts` walks the active tuning package and creates numeric controls for:

- enemy health, rewards, speed-related values, and collision damage;
- difficulty multipliers;
- projectile patterns;
- movement patterns;
- player weapons;
- bosses;
- encounters.

Each descriptor includes a stable ID, JSON path, category, owner, value, minimum, maximum, step, unit, and hot-reload status.

### 3.2 Runtime overlay

`StudioTuningOverlay` snapshots the canonical content registry once, validates an incoming `.sftuning` package, and replaces only the iframe-local runtime maps. The source package and base-game files are not overwritten.

The author can:

- set the active package as the A baseline;
- restore the baseline candidate;
- restore the built-in registry;
- export the candidate package;
- export a Markdown scalar-difference review.

Changing a value resets the current isolated arena so newly spawned entities use the candidate definition consistently.

## 4. Timeline transport

The runtime dock provides:

- play and pause;
- restart;
- forward and reverse 0.25-second step;
- playback at 0.25×, 0.5×, 1×, 2×, or 4×;
- a video-style scrub bar;
- loop-in and loop-out points;
- marker-based jumps;
- selectable 2, 5, or 10 second snapshot intervals.

The transport uses the level timeline as the shared clock. Isolated arenas call `advanceClockOnly()` so terrain/world time advances without starting unrelated authored encounters.

## 5. Snapshot-assisted seeking

### 5.1 Captured state

Periodic snapshots retain:

- level and capture time;
- player position;
- armor, shield, and energy;
- score and visible multiplier tier;
- dynamic terrain states;
- live enemy identity, health, movement state, mine state, and weapon timing;
- active player, enemy, and missile projectile state;
- active pickup state and reward identity;
- ground-target health, engagement, destruction, and weapon timing;
- active boss identity;
- current tuning fingerprint.

Snapshots remain inside the game iframe. The Studio host receives only an index containing snapshot ID, time, capture time, and entity counts.

### 5.2 Seek procedure

For a requested time:

1. locate the nearest snapshot at or before the target;
2. use `LevelTimeline.seekTo()` to rebuild authored event state at the anchor;
3. clear approximate active encounter objects created by the ordinary seek path;
4. restore the captured runtime objects and player state;
5. advance the short remainder in fixed 1/30-second steps;
6. pause or continue according to the current transport state.

When no suitable snapshot is available, the existing authored-event seek remains the fallback.

### 5.3 Explicit limitation

This is an authoring transport, not a deterministic replay certification or save-state format. The following may reconstruct approximately:

- particle systems;
- transient sound effects;
- exact boss phase internals;
- animation frame phase;
- low-level physics contact caches;
- encounter bookkeeping for entities already active at the anchor.

Shipping timing and difficulty must still be confirmed through uninterrupted playthroughs.

## 6. Attention analysis

`AttentionAnalyzer` combines the active Level and Tuning Packs to generate:

- normalized intensity bins;
- encounter markers;
- checkpoint markers;
- terrain-state markers;
- recovery markers;
- boss markers;
- automated local peaks;
- warnings.

Markers are drawn over the video transport and exposed as jump buttons. This gives designers a fast way to move among authored pressure changes rather than searching only by timestamp.

## 7. Telemetry and A/B comparison

The embedded runtime samples:

- active enemies;
- enemy projectiles;
- player projectiles;
- survivability;
- multiplier;
- frame time;
- calculated music/threat intensity.

The Studio renders a recent intensity heatmap and can capture the current series as A or B. The comparison table reports:

- mean active enemies;
- peak enemy projectiles;
- mean intensity;
- minimum survivability;
- p95 frame time.

The runtime bounds telemetry to 1,200 internal samples and transmits only the most recent 400 to prevent unbounded cross-frame messages.

## 8. New principal files

```text
src/schemas/studioSimulationSchema.ts
src/studio/simulation/SimulationTypes.ts
src/studio/simulation/SnapshotTransport.ts
src/studio/simulation/TunableParameters.ts
src/studio/simulation/TuningDiff.ts
src/studio/simulation/AttentionAnalyzer.ts
src/studio/simulation/TelemetryComparison.ts
src/studio/simulation/SimulationTools.test.ts
src/game/systems/StudioTuningOverlay.ts
src/game/systems/StudioSimulationRuntime.ts
```

Updated runtime/entity files include:

```text
src/game/scenes/GameScene.ts
src/game/entities/Enemy.ts
src/game/entities/Projectile.ts
src/game/entities/Pickup.ts
src/game/entities/Boss.ts
src/game/systems/EnemyWeapon.ts
src/game/systems/LevelTimeline.ts
src/game/systems/MultiplierSystem.ts
src/game/player/ShipDefenseSystem.ts
src/game/player/ShipEnergySystem.ts
src/main.ts
src/studio/StudioApp.tsx
src/studio/studio.css
```

## 9. Data and security boundaries

- Tuning packages remain data-only.
- Inputs are validated with Zod before becoming active.
- The runtime overlay exists only within the Studio iframe.
- Snapshot state is memory-only and is not embedded into exported packages.
- Full snapshots do not cross the iframe boundary.
- The production game does not expose the Studio bridge unless in development, E2E, or explicit Studio mode.

## 10. Acceptance coverage

Automated tests cover:

- snapshot interval and ring behaviour;
- nearest-anchor selection;
- legacy snapshot defaults;
- runtime interval reconfiguration;
- all arena schema values;
- tuning catalog generation and immutable updates;
- attention normalization and markers;
- telemetry summaries and A/B deltas;
- enemy weapon timing restoration;
- multiplier tier restoration;
- clock-only timeline advancement;
- existing package, content, economy, equipment, terrain, music, and lifecycle contracts.

The Playwright suite adds a Studio scenario for runtime startup, enemy arena selection, snapshot-interval changes, attention markers, and telemetry.

## 11. Recommended author workflow

1. Open `studio.html`.
2. Start the embedded runtime.
3. Select **Tuning**.
4. Choose the smallest arena that exercises the behaviour being adjusted.
5. Set an A baseline.
6. Run long enough to capture representative telemetry.
7. Capture A.
8. Modify one parameter group.
9. Use loop and attention markers to repeat the same authored section.
10. Capture B.
11. Review the telemetry delta and scalar tuning diff.
12. Confirm the candidate with an uninterrupted full-level run.
13. Export the `.sftuning` package and review Markdown.

## 12. Deferred work

Epoch 14 remains responsible for the production Asset Studio: image import, slicing, animation, pivots, hardpoints, collision previews, shadows, tilesets, and atlas packing.

More advanced deterministic replay, persisted author comments, batch simulation, statistical bot runs, and automated balance recommendations remain later Studio enhancements rather than Epoch 13 requirements.
