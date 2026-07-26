# Project SkyForge

Browser-based vertical scrolling shoot-'em-up with a focused level-design and gameplay-tuning toolchain.

## Current milestone

**Epoch 18.3 RC4 — Per-Level MP3 Music Library** adds content-addressed
project-local MP3 import, per-level assignment, preview, integrity checks, and
production playback through the existing Web Audio music director. It retains
the accepted Epoch 18.2 Blob-47 geometry and its **8.70/10** art-direction
baseline.

The canyon contains 8,831 explicit topology and set-dressing cells, while water remains a zero-cell world plane. See `docs/EPOCH_18_2_BLOB47_GEOMETRY_CORRECTION.md`, `docs/EPOCH_18_2_QA_AUDIT.md`, and `docs/EPOCH_18_2_BLOB47_GEOMETRY_EVIDENCE.png`.

## Start and verify

```sh
npm ci --no-audit --no-fund --progress=false
npm run dev
```

The portable release lockfile resolves public packages through `registry.npmjs.org`; it contains no build-environment or internal build-environment registry URLs.

Open `/studio.html`. The navigation should show **Level**, **Tuning**, **Assets**, and **Build** only. Open **Level** to work on the rebuilt canyon map and encounter timeline; use **Hide Runtime** when maximum editor width is needed. Terrain artwork is currently presentation-only: cliffs do not block or damage the player and do not consume projectiles.

Run the complete automated release audit with:

```sh
npm run audit:release
```

Current automated evidence: **400 passing tests across 60 files** and **16 scenarios** retained for Playwright browser certification.

### External asset and music workflow

1. Generate or create source artwork and audio outside the Studio.
2. Import approved PNG/WebP artwork through **Assets** and configure its gameplay metadata.
3. Import a complete `.sfmusic` package through the Studio toolbar when music is ready.
4. Validate the four-package workspace in **Build**, create a lock, and compile the production release.

### Collaboration and release

```sh
npm run studio:unpack -- examples/studio-packages/skyforge-placeholder-assets-1.0.0.sfassetpack ./work/assets
npm run studio:pack -- ./work/assets ./work/skyforge-placeholder-assets-1.0.0.sfassetpack
npm run audit:release
```

Current implementation and QA records are indexed in `docs/DOCUMENTATION_INDEX.md`.

## Stack

- **Phaser 4.2.1** (stable v4 confirmed on npm at scaffold time — matches the PDR's
  recommended engine)
- TypeScript (strict), Vite, Vitest, ESLint (flat config) + Prettier

## CI & deploy

GitHub Actions (`.github/workflows/ci.yml`) runs lint + typecheck + vitest + build +
Playwright smoke tests on every push. `deploy.yml` publishes to GitHub Pages (sets
`VITE_BASE` to the repo name for project-page hosting). The game (`/`), Level Studio (`/editor.html`), and Game Design Studio (`/studio.html`) are served. Run browser tests locally with `npm run test:e2e`.

## Prerequisites

**Node.js `^20.19.0` or `>=22.12.0` is required** (Vite 8 uses `util.styleText`,
added in Node 20.12). Older Node fails with:

```
SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'
```

Check your version:

```sh
node --version
```

If it's below 20.19 (e.g. v20.9.0), upgrade — **Node 22 LTS recommended**:

**Option A — nvm (recommended on macOS/Linux):**

```sh
# install nvm if you don't have it:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# then restart your terminal and:
nvm install 22
nvm use 22          # picks up this repo's .nvmrc automatically with `nvm use`
node --version      # should print v22.x
```

**Option B — Homebrew (macOS):**

```sh
brew install node@22
brew link --overwrite node@22
```

**Option C — installer:** download Node 22 LTS from https://nodejs.org

## Install & first run

```sh
cd skyforge
node --version        # must satisfy ^20.19.0 || >=22.12.0
rm -rf node_modules   # only if you previously installed with an older Node
npm ci --no-audit --no-fund --progress=false
npm run dev           # open the printed http://localhost:5173 URL
```

You should see the PROJECT SKYFORGE title screen; press any key to play.
If `npm install` prints an `EBADENGINE` error, your Node is still too old —
run `nvm use 22` in this terminal and reinstall.

Verify the toolchain (all should pass clean):

```sh
npm run audit:release && npm run build:base:verify
# browser suite (requires Playwright Chromium and WebKit)
npx playwright install chromium webkit
npm run test:e2e
```

## Commands

| Command             | Purpose                                 |
| ------------------- | --------------------------------------- |
| `npm install`       | Install dependencies                    |
| `npm run dev`       | Dev server with HMR                     |
| `npm run build`     | Typecheck + production build to `dist/` |
| `npm run preview`   | Serve the production build locally      |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run lint`      | ESLint over `src/`                      |
| `npm run format`    | Prettier write                          |
| `npm test`          | Vitest (unit tests)                     |
| `npm run build:release` | Production build plus bundle budgets |
| `npm run audit:release` | Full code, compiler, build and dependency gate |
| `npm run studio:unpack -- <pack> <folder>` | Convert portable package to Git folder |
| `npm run studio:pack -- <folder> <pack>` | Repack Git folder |
| `npm run studio:lock -- <workspace> <dir> <lock>` | Generate dependency lock |
| `npm run studio:compile -- <workspace> <dir> <lock> <out> [public]` | Compile release content |

## Architecture (current state)

```text
src/
├── main.ts                         # Phaser boot + development/E2E handle
├── game/
│   ├── config/                     # Phaser config, constants, depth/collision policy
│   ├── scenes/                     # Boot, menu, game, pause, settings, results, help
│   ├── entities/                   # Player, enemies, bosses, projectiles, pickups
│   ├── input/                      # Keyboard/gamepad/touch abstraction + menu navigation
│   ├── systems/                    # Combat, timeline, persistence, content, audio/music
│   ├── terrain/                    # Visual chunk renderer, routes, adjacency autotiling
│   ├── ui/                         # HUD and boss presentation
│   └── debug/                      # Overlay and telemetry
├── content/                        # Gameplay plus maps/routes/visual guides/biomes/packages
├── schemas/                        # Zod structural + semantic validation
├── editor/                         # Spatial/timeline Level Studio and Level Pack bridge
├── studio/                         # Four-package Studio shell, resolver, compiler, runtime bridge
└── shared/                         # Phaser-independent math and deterministic RNG
public/
└── audio/music/mission_01/         # Original synchronized demonstration stems
scripts/
├── verify-base-build.mjs           # GitHub Pages path and copied-asset verification
├── studio-folder.mjs               # Git-friendly package unpack/repack
├── create-studio-lock.mjs          # Deterministic dependency locks
├── compile-studio-release.mjs      # Release-resource compiler
└── check-build-budget.mjs          # Enforced production bundle budgets
```

Key runtime boundaries:

- `AudioManager` owns the user-gesture Web Audio context and master/music/SFX buses.
- `MusicDirector` owns synchronized stems, loop timing, adaptive state, pause/resume, and cleanup.
- `ContentRegistry` validates all JSON and cross-file references without permitting preview mutation.
- `SaveData` sanitizes persisted values per field and supports migrations.
- `RunSession` carries deliberate mission/checkpoint state across Phaser scene restarts without becoming persistent profile storage.
- `LevelTimeline` accepts an optional immutable editor preview definition and supports deterministic seeking.
- `TerrainRuntime` is a presentation-only chunk renderer; it does not clamp or damage the player and does not block projectiles.
- `Autotile` derives Cardinal-16 cliff and rim variants from N/E/S/W occupancy, including map-exterior continuity.
- `TerrainAnalysis` and the dormant non-blocking corridor guide remain available for level-readability analysis while collision is reconsidered.
- `DependencyResolver` and `ContentCompiler` validate package sets independently of the Studio UI.
- `PackageMigrations`, `DependencyLock`, `FolderProject`, `PackageReview`, and `ProductionCompiler` own collaboration and release semantics independently of React.
- The Studio message bridge controls the same `GameScene`/`LevelTimeline` runtime used by normal play.

Conventions in force: depth layers via `DEPTHS`, collision bitmasks via `COLLISION`, content time in seconds, `snake_case` content IDs, and data-driven definitions validated by Zod.

### Design addenda

- `docs/GAME_DESIGN_STUDIO_ARCHITECTURE.md`
- `docs/EPOCH_12_PDR_REVIEW.md`
- `docs/MUSIC_DIRECTION_AND_ADAPTIVE_AUDIO.md`
- `docs/SHIP_CONFIGURATION_EQUIPMENT_ECONOMY_PROGRESSION.md`
- `docs/SOLID_TERRAIN_NAVIGATION_AND_LEVEL_COMPOSER.md` *(historical/deferred collision design)*
- `docs/TILE_ASSET_PIPELINE_AND_LEVEL_COMPOSER.md`

Epochs 12–15 establish the package shell and four authoring workspaces. Epoch 16 completes schema migration, locks, Git-folder collaboration, review gates, release compilation, build budgets, and browser-device automation.

## Sprint log

| Sprint | Date       | Status | Notes                                                                                                        |
| ------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| S0.1   | 2026-07-11 | ✅     | Scaffold, render loop, FIT scaling, FPS counter                                                              |
| S0.2   | 2026-07-11 | ✅     | ESLint/Prettier/Vitest, skeleton dirs, mathUtils                                                             |
| S0.3   | 2026-07-11 | ✅     | Boot→Preload→Menu→Game flow, placeholder textures, input gate                                                |
| S1.1   | 2026-07-11 | ✅     | Ship movement, normalized diagonals, bounds clamp                                                            |
| S1.2   | 2026-07-11 | ✅     | InputManager snapshot API, focus mode + hitbox dot                                                           |
| S1.3   | 2026-07-11 | ✅     | Projectile pool (200), WeaponSystem v1 pulse cannon                                                          |
| S1.4   | 2026-07-11 | ✅     | Seeded starfield parallax, ScrollController, rng util                                                        |
| S2.1   | 2026-07-11 | ✅     | Enemy entity + pool (64), temp spawner, despawn                                                              |
| S2.2   | 2026-07-11 | ✅     | Bullet→enemy collisions, hit flash, shared explosion emitter, score                                          |
| S2.3   | 2026-07-11 | ✅     | Aimed enemy fire, 5px player hitbox, hull/i-frames, death→GameOver→retry                                     |
| S2.4   | 2026-07-11 | ✅     | Event-driven HUD: hull pips, padded score w/ punch, weapon label                                             |
| S2.5   | 2026-07-11 | ✅     | DebugOverlay: \` toggle, H hitboxes, I invuln, K kill-all, [ ] timescale                                     |
| S3.1   | 2026-07-11 | ✅     | Zod schemas, ContentRegistry (glob+validate+refs), enemy JSON, in-game error panel                           |
| S3.2   | 2026-07-11 | ✅     | pulse_cannon.json 3 levels, generic WeaponSystem v2, keys 1/2/3                                              |
| S3.3   | 2026-07-11 | ✅     | 3 projectile patterns, EnemyWeapon component, pattern-math tests                                             |
| S3.4   | 2026-07-11 | ✅     | MovementRunner (position-based): straight/sine/sweep/patrol, F1-F4                                           |
| S3.5   | 2026-07-11 | ✅     | bezier/dive_retreat/stop_and_fire/enter_attack_exit, F5-F8; orbit/follow deferred                            |
| R1.1   | 2026-07-11 | ✅     | Triple parallax (config-driven layers); Level Composer = Epoch 11 (see roadmap Revision 1.1)                 |
| S4.1   | 2026-07-11 | ✅     | FormationSpawner, member scheduling, cleared/done tracking                                                   |
| S4.2   | 2026-07-11 | ✅     | 6 formations + heavy_fighter/interceptor, formation demo keys                                                |
| S4.3   | 2026-07-11 | ✅     | EncounterRunner: timed events, wait_for_clear, flags, completion, concurrency                                |
| S4.4   | 2026-07-11 | ✅     | LevelTimeline, checkpoints, recovery, debug seek (, . C); temp spawner removed                               |
| S4.5   | 2026-07-11 | ✅     | WorldScroll (+scrollProfile), GroundTarget turrets, seek-safe                                                |
| S5.1   | 2026-07-11 | ✅     | Bomber, ring_burst, mines-as-enemies, multi-weapon slots                                                     |
| S5.2   | 2026-07-11 | ✅     | Pickup entity/pool, drop resolution, auto-flags, weapon_upgrade/shield                                       |
| S5.3   | 2026-07-11 | ✅     | spread_cannon 3 levels, weapon swap (Q key / pickup)                                                         |
| S5.4   | 2026-07-11 | ✅     | Missile system: separate pool, homing (steerAngle), secondary slot + HUD bar                                 |
| S5.5   | 2026-07-11 | ✅     | MultiplierSystem x1-x5, meter/decay/damage, rapid-group bonus, HUD                                           |
| S5.6   | 2026-07-11 | ✅     | Minefield hazard (mines unified as enemies), content-validation CI test                                      |
| S6.1   | 2026-07-11 | ✅     | Boss framework: phases, telegraph, destructible parts, enrage, defeat, HP bar                                |
| S6.2   | 2026-07-11 | ✅     | Miniboss Alpha (Sentinel), 2 phases + enrage                                                                 |
| S6.3   | 2026-07-11 | ✅     | Boss Alpha (Dreadnought), 3 phases, side-turret parts, angleSweep fan, ResultsScene                          |
| UI     | 2026-07-11 | ✅     | Navigable menu + paged How-to-Play help screen                                                               |
| S7.1   | 2026-07-11 | ✅     | Level 01 "Coastal Approach": 15 encounters + miniboss + boss, sawtooth pacing, scrollProfile                 |
| S7.2   | 2026-07-11 | ✅     | DifficultyManager (easy/normal/hard), 3 consumption hooks, menu selector, content pristine                   |
| S8.1   | 2026-07-11 | ✅     | React editor shell, level dropdown, event list, add/delete, export/import, autosave                          |
| S8.2   | 2026-07-11 | ✅     | Inspector (type-aware fields + encounter peek), validation panel, intensity strip                            |
| S8.3   | 2026-07-11 | ✅     | Embedded iframe preview, ?preview=1 game mode, play-from-event, working-copy override                        |
| S9.1   | 2026-07-11 | ✅     | AudioManager (WebAudio synth), category volumes, concurrency caps, boss music, visibility mute               |
| S9.2   | 2026-07-11 | ✅     | Gamepad backend + touch (drag-anywhere relative move, on-screen buttons), last-device-wins                   |
| S9.3   | 2026-07-11 | ✅     | SaveData (versioned, migration, corruption-safe), Settings scene, live-apply                                 |
| S9.4   | 2026-07-11 | ✅     | Pause overlay (scene.pause), level intro card, blur auto-pause, checkpoint retry, high score                 |
| S9.5   | 2026-07-11 | ✅     | Telemetry (deaths/encounters/weapons/fps/peaks), stress harness (T), reduced-particles, shake/flash settings |
| S9.6   | 2026-07-11 | ✅     | Playwright smoke tests, GitHub Actions CI, Pages deploy workflow, dev handle                                 |
| 9R     | 2026-07-12 | ✅     | Release-gate remediation + synchronized adaptive music foundation; 160 tests                                 |
| 10     | 2026-07-12 | ✅     | Equipment, credits, Hangar, settlement, progression, runtime ship stats                                      |
| 11     | 2026-07-12 | ✅     | Level Package v2, canyon terrain, swept collision, routes, spatial Composer                                  |

## Phaser 4 API notes (differences from v3 found so far)

- `setTintFill(color)` is a deprecated no-op → use `setTint(color).setTintMode(Phaser.TintModes.FILL)`,
  and restore `TintModes.MULTIPLY` when clearing (see `Enemy.resetTint()`).
- `world.createDebugGraphic()` returns the Graphics object — use the return value.

## Dev controls (current)

Move: WASD/arrows · Fire: Space · Focus: Shift · ESC: menu (Pause in S9.4)
Debug (dev builds): \` overlay · H hitboxes · I invulnerability · K kill all · [ ] time scale
Weapon levels: 1 / 2 / 3 · Movement demos: F1 straight, F2 sine, F3 sweep, F4 patrol, F5 bezier, F6 dive, F7 stop-and-fire, F8 enter-attack-exit (F-keys captured while focused)
Formation demos: 4 v-scouts, 5 row, 6 left-sweep, 7 right-sweep, 8 column, 9 pinch, 0 escort
Timeline (dev): , seek -10s · . seek +10s · C cycle checkpoints
Weapons: X fire missiles (secondary) · Q toggle pulse/spread (dev)
Boss (dev): B force-advance boss phase
Menu: arrows/WASD + Enter to navigate; Settings + How to Play screens
Perf (dev): T spawn worst-case stress scene · telemetry export on Results screen
Music (debug overlay): current cue, adaptive state, bar/beat, and AudioContext state
Controls: keyboard / gamepad / touch all supported (last device wins) — see TUNING_GUIDE §17

**Levels:** `level_01` "Canyon Approach" (terrain vertical slice, default), `level_dev` (content parade), `level_boss_test` (bosses back-to-back). Load via `?level=<id>`.

**Level Composer:** `npm run dev` then open `/editor.html`. Edit Level Package v2 maps, layers, materials, routes, visual objects, and timeline events; regenerate connected cliff/rim variants; preview unsaved changes; import/export the complete multi-file package. Collision authoring is not part of the active Epoch 18 workflow. See `docs/TUNING_GUIDE.md` §15.

### Level 01 pacing and terrain

The original rising sawtooth remains, now presented over a connected visual canyon whose width and centerline follow authored mission beats across the full 250-second scroll. Recovery valleys remain at 56s & 152s. Every enemy type is introduced in isolation before combination; no non-finale skill repeats back-to-back. Finale (final_escalation → boss_alpha) intentionally combines taught skills per PDR §5.3. The canyon is decorative in this release and imposes no collision pressure.

### Difficulty (S7.2)

easy/normal/hard chosen on the menu (←→). Scales enemy health, bullet speed, and spawn delays at consumption — loaded content is never mutated.

**Design docs:** `docs/TUNING_GUIDE.md` explains gameplay, level, device, and adaptive-music tuning. `docs/MUSIC_DIRECTION_AND_ADAPTIVE_AUDIO.md` defines final soundtrack production. `docs/SHIP_CONFIGURATION_EQUIPMENT_ECONOMY_PROGRESSION.md` defines the implemented hybrid equipment/currency contract, with evidence in `docs/EPOCH_10_IMPLEMENTATION.md`. `docs/TILE_ASSET_PIPELINE_AND_LEVEL_COMPOSER.md` and `docs/EPOCH_11_IMPLEMENTATION.md` define the current terrain/editor implementation. `docs/skyforge_roadmap.md` remains the delivery sequence.

### Known simplification: timeline seek (S4.4)

Seeking (`,`/`.`, checkpoint retry) hard-clears live play and restarts any encounter whose window contains the target time from its beginning — it does NOT reconstruct mid-flight enemy positions. This is intentional for an authoring/debug tool; a full deterministic replay is out of slice scope.

## Acceptance evidence (current)

- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run build:base:verify`, and `npm run build:budget` pass; Vitest reports **400 passing tests across 60 files**.
- Negative security coverage verifies unsafe IDs, filesystem containment, malicious resource filenames, non-empty unpack targets, package drift, and production Studio-bridge authorization.
- React component tests cover map painting, stroke transaction coalescing, minimap navigation math, object hit-testing, and focused Studio package workflows. Playwright contains **16 scenarios** (20 configured browser-project executions) and CI installs Chromium and WebKit before executing them.
- The production runtime does not expose mutable debug controls through `?studio=1`; embedded Studio control requires a same-origin session nonce.
- `npm audit --audit-level=high` reports **0 vulnerabilities**.
- Manual target-device verification remains required for physical iPhone/controllers, cross-browser rendering, FPS stability, resize/letterbox behaviour, and final terrain feel.

### Epoch 13 Simulation & Tuning Lab

The Studio runtime dock now provides play/pause, ±0.25-second stepping, 0.25×–4× speed, a video-style scrubber, loop regions, configurable snapshot intervals, attention markers, and live telemetry. The Tuning workspace can apply transient validated overlays to the real Phaser runtime and compare A/B captures across full-level, enemy, weapon, formation, encounter, boss, route, and loadout arenas.

Snapshot seeking restores player resources, retained presentation state, live enemies, enemy weapon timers, projectiles, pickups, score, and multiplier tier before replaying the short remainder. It is an authoring aid rather than a certified replay format.
