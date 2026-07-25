# Epoch 9R Implementation Report

**Status:** Implemented and conventionally verified  
**Date:** 2026-07-12  
**Source baseline:** Epoch 9 review package  
**Purpose:** Repair release-gate defects identified in Epoch 9 and install the first production-shaped adaptive-music foundation.

## 1. Release-gate outcome

Epoch 9R resolves the highest-risk lifecycle, input, persistence, editor-integrity, telemetry, deployment, and audio issues identified during the Epoch 9 review.

Verified in the implementation workspace:

- strict TypeScript passes;
- ESLint passes across runtime, editor, test, and configuration files;
- 160 Vitest unit/content/schema tests pass;
- production build passes;
- project-page base-path build passes and verifies copied music assets;
- `npm audit` reports no known dependency vulnerabilities at implementation time.

The Playwright suite launches Chromium but cannot navigate to localhost in the implementation sandbox because browser navigation is blocked by administrator policy. CI installs Playwright Chromium and remains the authoritative browser-test environment.

## 2. Epoch 9R repairs

### 2.1 Input and controls

- Phaser Gamepad Plugin is explicitly enabled.
- Reusable edge-triggered menu gamepad navigation is available in Menu, Help, Settings, Pause, Results, and Game Over scenes.
- Runtime input arbitration tracks the most recently active keyboard, gamepad, or touch device.
- Gamepad special fire is edge-triggered.
- Touch action buttons are excluded from the movement pointer region.
- Saved touch sensitivity is applied and clamped.
- Touch-primary devices use a bounded mobile quality profile.
- Input listeners and transient state are explicitly cleaned up on shutdown and pause.

### 2.2 Pause, Settings, restart, and scene lifecycle

- Pause → Settings now sleeps the Pause scene and keeps the active Game scene paused.
- Leaving Settings wakes the same Pause scene instead of starting a new run.
- Resume returns to the same player position and level time.
- Restart and quit stop adaptive music and clear runtime ownership.
- Game state fields are reset explicitly for each run.
- `RunSession` explicitly distinguishes fresh missions from checkpoint continuations and rolls score/temporary weapon state back to the captured checkpoint while preserving run identity and death statistics.
- Boss visuals, colliders, input listeners, blur handlers, music sources, and debug listeners are cleaned up on scene shutdown.
- Debug overlay keyboard handlers and refresh timer are now destroyable, preventing duplicate handlers after repeated restarts.

### 2.3 Browser audio lifecycle

- The Web Audio context is created only from a real pointer, keyboard, or gamepad gesture.
- Music and sound effects share one AudioContext and category buses.
- Master, music, and SFX volumes remain centrally controlled.
- Audio suspension and recovery are handled for visibility changes.
- Direct level/editor preview entry has its own unlock fallback.

### 2.4 Settings and persistence

- Save data is parsed through a versioned Zod-backed boundary.
- Corrupt or out-of-range fields fall back independently rather than invalidating the complete save.
- Touch sensitivity, particles, flashes, shake, and audio settings apply safely.
- High-score presentation is based on an explicit result from `recordRun()` rather than comparing against an already-updated stored value.

### 2.5 Editor and content integrity

- Level schemas now apply semantic checks for ordering, duration, duplicate checkpoints, scroll overlap, scroll bounds, and ground placement.
- Editor validation uses the shared level schema.
- Invalid levels are blocked from normal export.
- Autosaves are stored per level with legacy migration.
- Preview levels are passed as an immutable runtime override rather than mutating the canonical content registry.
- Game/editor/preview links use `import.meta.env.BASE_URL` and support GitHub Pages project paths.

### 2.6 Telemetry and browser testing

Telemetry now records:

- run metadata;
- encounters completed;
- weapon-use time;
- damage and death locations;
- projectile peaks;
- time-weighted multiplier;
- frame-time distribution and FPS samples.

The Playwright smoke suite covers:

- validated menu boot;
- keyboard start, movement, and music cue activation;
- Pause → Settings → Pause run preservation;
- a 30-second accelerated runtime soak;
- editor and preview base-path links.

The E2E-only `window.__skyforge` handle is restricted to development or explicit `VITE_E2E=1` builds.

## 3. Adaptive music implementation

### 3.1 Content model

Music is now data-driven under `src/content/music/` and validated by `MusicCueSchema`.

A cue defines:

- cue ID and display name;
- BPM and beats per bar;
- loop boundaries;
- synchronized stem assets;
- default stem gain;
- gain multipliers for recovery, normal, combat, critical, and boss states;
- optional full-mix reference.

Levels reference a cue ID through their existing `music` property. ContentRegistry cross-validates that reference.

### 3.2 MusicDirector

`MusicDirector` is independent of `GameScene` and owns:

- deferred cue loading after audio unlock;
- decoding and caching stem buffers;
- sample-aligned start scheduling on one AudioContext;
- looping at cue-defined boundaries;
- adaptive gain ramps;
- pause/resume offset preservation;
- deterministic stop and source cleanup;
- cue/state/bar/beat debug information.

All stems are scheduled for the same future AudioContext timestamp. This avoids the drift introduced by sequential high-level playback calls.

### 3.3 Adaptive intensity

`MusicIntensityModel` is a pure, unit-tested model. Runtime threat currently considers:

- active enemies;
- active enemy projectiles;
- boss presence;
- player hull danger.

The model uses broad bands, hysteresis, and a 1.75-second dwell period to prevent rapid layer flicker.

Current state transitions:

```text
recovery ↔ normal ↔ combat ↔ critical
                         ↘ boss (forced by boss lifecycle)
```

### 3.4 Demonstration cue

`coastal_assault` is an original 60-second, 128 BPM, D-minor FM/tracker-style demonstration. Four synchronized OGG stems are included:

- drums;
- bass;
- harmony;
- lead.

The cue is a technical and musical-direction test asset. It is not intended to represent the final mastered Mission 1 soundtrack.

### 3.5 Debugging

The developer overlay now displays:

```text
music: <cue> <state> b<bar>.<beat> (<AudioContext state>)
```

The E2E handle exposes a structured music debug snapshot.

## 4. Mobile quality profile

Touch-primary devices currently use:

- maximum 300 active enemy bullets instead of 500;
- 50% particle counts.

The reduced-particles setting also selects the 50% particle profile. Pool sizes are selected at run creation and are intentionally not resized mid-level.

## 5. Files added or materially changed

Major additions:

```text
src/content/music/
src/schemas/musicSchema.ts
src/game/systems/MusicDirector.ts
src/game/systems/MusicIntensityModel.ts
src/game/systems/RuntimeQualityProfile.ts
src/game/systems/RunSession.ts
src/game/input/MenuGamepadNavigator.ts
public/audio/music/mission_01/
scripts/verify-base-build.mjs
docs/MUSIC_DIRECTION_AND_ADAPTIVE_AUDIO.md
docs/SHIP_CONFIGURATION_EQUIPMENT_ECONOMY_PROGRESSION.md
```

Major repaired areas:

```text
AudioManager
InputManager
GameScene
PauseScene / SettingsScene
SaveData
Telemetry
ContentRegistry
LevelTimeline
Level editor store and validation
CI and Pages deployment
Playwright smoke suite
```

## 6. Deferred work

These items are deliberately not presented as complete:

1. **Dedicated final cues:** The current cue reuses one adaptive composition for mission and boss intensity. Final hangar, boss, victory, failure, and economy cues remain to be commissioned or composed.
2. **Bar-aligned cue-to-cue transitions:** Stem states ramp correctly, but a full transition/stinger scheduler is a later music milestone.
3. **Actual iPhone QA:** Architecture supports mobile browser policy, but physical-device testing is still required.
4. **Deterministic benchmark mode:** The 30-second browser soak exists; a reproducible performance benchmark with captured metrics remains future work.
5. **Stable editor event IDs:** Per-level autosave and immutable preview are complete, but selection still uses array position.
6. **Broader GameScene decomposition:** A pure `RunSession` boundary now owns checkpoint-continuation state, but presentation, telemetry bridging, and several runtime coordinators still need extraction. Equipment/economy work must use the session/profile boundaries rather than add more direct responsibility.
7. **Configurable keybindings and fullscreen:** Not implemented in Epoch 9R.
8. **Currency/equipment runtime:** Specified in the ship/economy addendum, but implementation belongs to the next epoch.

## 7. Collaboration rules for the next epoch

Before adding ship equipment and economy:

- preserve the green type/lint/unit/content/base-build gates;
- run Playwright in CI for every pull request;
- keep equipment definitions data-driven and schema-validated;
- introduce a persistent `PlayerProfile`/economy boundary outside `GameScene`;
- calculate derived ship statistics through one pure function;
- do not mutate canonical content for previews or runtime upgrades;
- add migrations for every persistent save-format change;
- add runtime features behind small acceptance-tested increments.

## 8. Recommended next sequence

1. Merge and manually verify Epoch 9R on desktop and iPhone.
2. Confirm audio unlock, pause/resume, music loops, touch controls, and gamepad navigation.
3. Create an Epoch 10 branch for profile, credits, inventory, equipment schemas, loadout validation, and derived-stat calculation.
4. Keep final art and full soundtrack production separate from mechanics until the loadout/economy loop is stable.
