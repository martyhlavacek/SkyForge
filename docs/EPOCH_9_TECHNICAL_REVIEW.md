# Project Skyforge — Epoch 9 Technical Review and Epoch 10 Handoff

**Reviewed build:** `skyforge-epoch9.zip`  
**Reviewed commit:** `863134f` — “S9.1–S9.6: audio, gamepad/touch, settings+persistence, pause/flow, telemetry, CI+deploy”  
**Comparison baseline:** `b1c7aff` — Epoch 8 editor completion  
**Review purpose:** Release gate before beginning the next epoch

---

## 1. Gate decision

**Decision: CONDITIONAL PASS.**

Epoch 9 adds useful platform and quality-of-life foundations, and the conventional toolchain is healthy. However, it should **not be considered fully accepted yet**. Several roadmap deliverables are either incomplete or incorrectly wired, and four issues can cause visible failures in normal play:

1. Phaser’s gamepad plugin is not enabled in `gameConfig`, so the new gamepad backend cannot function.
2. Opening Settings from Pause stops the active game and starts a new game when leaving Settings.
3. Audio unlock is attempted before a user gesture rather than during the first gesture, so browser autoplay policy may leave audio permanently suspended.
4. `GameScene` does not reliably reset run-scoped state when the same Phaser scene instance is restarted.

Complete a small **Epoch 9R remediation gate** before implementing the full equipment/economy system. Do not mix these repairs into the first large equipment commit; preserve a clean regression boundary.

---

## 2. Verification performed

| Check                                  |         Result | Notes                                                                                                 |
| -------------------------------------- | -------------: | ----------------------------------------------------------------------------------------------------- |
| `npm ci`                               |           Pass | 146 packages installed; zero reported vulnerabilities                                                 |
| `npm run typecheck`                    |           Pass | TypeScript completed without errors                                                                   |
| `npm run lint`                         |           Pass | Current `src/` lint scope passes                                                                      |
| `npm test`                             |           Pass | **132 tests across 11 files**                                                                         |
| `npm run build`                        |           Pass | Production game and editor bundles generated                                                          |
| Playwright source review               | Pass with gaps | Test definitions and CI browser install are present                                                   |
| Playwright execution in review sandbox | Not executable | Sandbox browser/network policy blocked local-page execution; this is not treated as a product failure |

### Production bundle

```text
main JavaScript:    1,450.59 kB minified / 380.43 kB gzip
editor JavaScript:    199.41 kB minified /  62.86 kB gzip
content chunk:        109.99 kB minified /  29.12 kB gzip
```

The main bundle remains large but is not the immediate release blocker. Phaser accounts for much of it. Code splitting should follow architectural cleanup rather than precede it.

---

## 3. What Epoch 9 did well

### 3.1 The changes are focused and understandable

The Epoch 9 diff is approximately 1,400 added lines spread across audio, input, persistence, screen flow, telemetry, E2E tests, and deployment. The changes do not significantly disturb the data-driven enemy, encounter, boss, and level systems.

### 3.2 Save data has a migration seam

`SaveData.ts` introduces a versioned blob, defaults, a migration function, corruption recovery, and tests. This is a useful starting seam for the upcoming player profile, currency, inventory, and loadout data.

### 3.3 Audio is abstracted from gameplay callers

Gameplay code calls a central `audio` service rather than constructing WebAudio nodes itself. This will make it possible to replace generated placeholder sounds with loaded assets later without rewriting combat systems.

### 3.4 Input still converges on one runtime state

Keyboard, touch, and attempted gamepad input all feed `InputState`. The player remains unaware of concrete devices. That is the correct boundary, even though device arbitration and menu integration are incomplete.

### 3.5 Pause is represented as a separate scene

Using a Pause overlay rather than a boolean branch inside `GameScene` is directionally correct. The broken Settings transition is repairable without discarding the scene approach.

### 3.6 Telemetry is local and testable

The recorder is independent, does not transmit external analytics, exports JSON, and has focused unit tests. The main remaining problem is incomplete gameplay wiring.

### 3.7 CI and deployment scaffolding are present

Lint, typecheck, tests, build, Playwright installation, artifact upload, and GitHub Pages deployment are defined. The next step is to tighten gating and test the deployed base path.

---

# 4. Release-blocking findings

## P0-1 — Gamepad support is disabled in Phaser configuration

**Files:**

- `src/game/config/gameConfig.ts`
- `src/game/input/InputManager.ts`

`InputManager.readGamepad()` reads `this.scene.input.gamepad?.pad1`, but `gameConfig` does not enable Phaser’s Gamepad Plugin. Phaser’s configuration default for `input.gamepad` is false. Therefore, `scene.input.gamepad` will not become a functional backend in the current build.

### Required repair

Add gamepad input explicitly:

```ts
export const gameConfig: Phaser.Types.Core.GameConfig = {
  // ...
  input: {
    gamepad: true,
  },
};
```

Then verify controller connection both before and after scene creation.

### Required tests

- A connected controller can start from the title screen.
- D-pad and left stick both move the player.
- Primary, secondary, focus, special, and pause buttons map correctly.
- Disconnecting the controller returns a neutral state without an exception.
- Reconnecting works without reloading the page.

---

## P0-2 — Pause → Settings destroys the active run

**Files and behavior:**

- `PauseScene.openSettings()` starts `SettingsScene` with `returnScene: GameScene`.
- It then explicitly stops `GameScene`.
- `SettingsScene.exit()` calls `this.scene.start(this.returnScene)`.
- Leaving Settings therefore creates a fresh `GameScene` instead of returning to the paused run.

This contradicts both the scene comment and the roadmap requirement that Settings return to Pause while preserving the game underneath.

### Required repair

Keep `GameScene` paused and alive:

1. Pause `PauseScene` or hide its input while Settings is open.
2. Launch `SettingsScene` above it.
3. Set `returnScene` to `PauseScene`, not `GameScene`.
4. When Settings exits, stop Settings and resume Pause.
5. Only Resume should resume `GameScene`.

One valid pattern:

```ts
// PauseScene
private openSettings(): void {
  this.scene.pause();
  this.scene.launch(SCENES.SETTINGS, {
    returnScene: SCENES.PAUSE,
    overlay: true,
  });
}
```

```ts
// SettingsScene
private exit(): void {
  this.scene.stop();
  this.scene.resume(this.returnScene);
}
```

The exact implementation may differ, but the active game object graph must remain untouched.

### Required regression test

Start a boss encounter, pause, open Settings, change volume, return, resume, and assert:

- level time is unchanged while paused;
- boss health and phase are unchanged;
- score, multiplier, active loadout, and checkpoint are unchanged;
- no duplicate enemy, collider, or listener is created.

---

## P0-3 — Audio unlock is not synchronized with the first user gesture

**Files:**

- `src/game/scenes/MenuScene.ts`
- `src/game/systems/AudioManager.ts`

`MenuScene.create()` calls `audio.unlock()` immediately and sets `AUDIO_UNLOCKED` true. Reaching MenuScene is not itself a user gesture. Browsers may create the `AudioContext` in a suspended state and reject or defer `resume()`. Subsequent menu actions call `audio.play()` but do not guarantee another synchronous `resume()` inside the click/key event.

### Required repair

Call `audio.unlock()` synchronously from the first pointer, keyboard, or gamepad confirmation handler. The handler should unlock before playing the UI confirmation sound.

Recommended behavior:

```ts
private confirm(): void {
  audio.unlock();
  audio.play('uiConfirm');
  // ...
}
```

Also attach a one-time fallback handler for any first interaction on the menu canvas.

Do not set `AUDIO_UNLOCKED` until `AudioContext.state` is `running`, or remove the registry flag if it has no meaningful consumer.

### Required tests

- Fresh page load produces no sound before input.
- First Enter/click/controller confirm starts audio.
- A context initially reported as `suspended` becomes `running` after the gesture.
- Returning from a hidden tab does not create a burst of queued music notes.

---

## P0-4 — Run-scoped `GameScene` state is not comprehensively reset

**File:** `src/game/scenes/GameScene.ts`

Phaser reuses scene instances. Field initializers do not rerun every time `scene.start(GameScene)` recreates the scene. `create()` resets `ending` and telemetry but does not explicitly reset all run-scoped fields, including:

- `boss`
- `bossBulletOverlap`
- `maxMultiplier`
- `deaths`
- `currentPrimary`
- deterministic drop RNG state
- `debugOverlay`
- preview/debug flags that may have been set during a previous run

A death or stop during an active boss can leave references to destroyed objects. A later `create()` may then treat stale properties as current state. Some values may intentionally persist across checkpoint retries, but that policy is currently accidental rather than explicit.

### Required repair

Introduce explicit run/session data and a reset boundary.

```ts
interface RunState {
  score: number;
  deaths: number;
  maxMultiplier: number;
  checkpointAt?: number;
  weaponState: RuntimeWeaponState;
  missionCredits: number;
}
```

At minimum, add:

```ts
private resetSceneState(): void {
  this.boss = null;
  this.bossBulletOverlap = null;
  this.maxMultiplier = 1;
  this.deaths = 0;
  this.currentPrimary = 'pulse_cannon';
  this.debugOverlay = null;
  this.previewMode = false;
  this.ending = false;
  this.dropRng = mulberry32(RUN_SEED);
}
```

Then distinguish:

- new mission;
- full mission restart;
- checkpoint retry;
- editor preview seek.

Those flows should pass a deliberate `RunSnapshot`, not depend on surviving scene fields.

### Required tests

Run at least five start/stop/retry cycles and assert no stale boss, duplicated listener, incorrect weapon toggle, inherited maximum multiplier, or unexpected RNG continuation.

---

# 5. High-priority functional gaps

## P1-1 — “Last device wins” is documented but not implemented

`InputManager.getState()` merges keyboard and gamepad with boolean/number `||` operations. This is not last-device arbitration. Keyboard input generally wins when nonzero, and mixed-axis combinations can be produced from multiple devices.

### Required design

Track `activeDevice: 'keyboard' | 'gamepad' | 'touch'` and a timestamp/counter of meaningful activity. A device becomes active when it exceeds an input threshold or produces a button edge. Read movement and held actions only from the active device, with optional simultaneous accessibility exceptions.

Expose the active device so menus can display the correct prompts.

---

## P1-2 — Gamepad does not cover the full screen flow

Even after enabling the Phaser plugin, the title, Help, Settings, Pause, Game Over, and Results screens use keyboard/pointer listeners directly. The roadmap acceptance criterion says the full level must be clearable without touching the keyboard. Currently the controller cannot reliably start the game, navigate settings, resume from pause, or leave Results.

### Required repair

Create a small reusable UI navigation adapter, for example:

```ts
interface MenuInputFrame {
  upPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  confirmPressed: boolean;
  cancelPressed: boolean;
}
```

Use it in every menu scene. Do not duplicate raw gamepad button polling across scenes.

---

## P1-3 — Gamepad `special` is held, not edge-triggered

`InputState` documents `special` as edge-triggered, but `readGamepad()` returns the current B-button state every frame. Holding the button can activate a special repeatedly once that mechanic is implemented.

Track previous states for all edge-triggered actions, not only Start/pause.

---

## P1-4 — Touch button touches can be captured as movement touches

`enableTouch()` registers global pointer handlers. The first pointer down anywhere becomes the movement anchor and enables primary fire. The separately interactive secondary and pause circles are not excluded from that global handler.

This can cause a button touch to:

- start movement anchoring;
- start primary auto-fire;
- leave the movement pointer stuck if GameScene is paused before the pointer-up reaches it.

### Required repair

- Assign movement only when the pointer is outside reserved UI hit regions.
- Track button pointer IDs separately.
- Handle `pointercancel`, `gameout`, scene pause, and blur.
- Add `InputManager.resetTransientState()` and call it before opening Pause and during shutdown.
- Consume touch pause unconditionally before OR-merging inputs, so it cannot remain queued when another pause source wins the expression.

---

## P1-5 — Touch sensitivity setting is never applied

`InputManager.setTouchSensitivity()` exists, but there is no call site. The slider persists a value that does not change gameplay.

Call it immediately after creating `InputManager`:

```ts
this.inputMgr.setTouchSensitivity(saveData.settings.touchSensitivity);
```

If Settings can be opened without recreating GameScene, publish settings changes or apply the new value when returning from Settings.

---

## P1-6 — Mobile performance behavior is not implemented

The roadmap requires touch-active mode to reduce particle counts and cap enemy bullets at 300. Current pools are always created with 500 enemy bullets, and `isTouchActive` is unused. Reduced-particle mode only affects the ordinary enemy-kill explosion count; boss, player-death, and pickup effects ignore it.

### Required repair

Centralize presentation/performance settings:

```ts
interface RuntimeQualityProfile {
  maxEnemyBullets: number;
  particleScale: number;
  allowCameraShake: boolean;
}
```

Select it once when the run starts. Avoid dynamically resizing pools mid-run.

---

## P1-7 — Audio roadmap requirements are only partly implemented

Problems:

- `SoundDef.priority` is never used.
- Concurrency caps drop the newest sound; they do not replace the oldest low-priority sound.
- `playSound` and `playMusicCue` encounter events still fall through to “not implemented”.
- Music uses `window.setInterval`, independent of Phaser scene pause.
- The visibility handler suspends the context but leaves the music interval running, potentially scheduling many nodes at the same frozen AudioContext time.
- `musicOsc` is unused.
- Music is not explicitly stopped or transitioned on Game Over, Results, Pause, or Quit.

### Required repair

For the placeholder phase, keep the system simple but correct:

1. Implement an audio state machine: `menu | level | boss | paused | silent`.
2. Pause/duck music when the game pauses and restore the previous state on resume.
3. Stop the scheduling timer when hidden; restart it on visibility return.
4. Either implement priority replacement or remove the unused field and change the roadmap claim.
5. Add typed encounter event payloads for sound/music keys and wire them through `EncounterRunner` hooks.
6. Add unit tests around concurrency accounting and visibility/pause transitions with a mock audio backend.

---

## P1-8 — Settings and save acceptance are incomplete

The roadmap calls for keyboard remapping and fullscreen. Neither is implemented. The save interface also has no `keybinds` field.

Additionally, `migrate()` merges parsed JSON directly into settings without runtime validation or clamping. Valid JSON such as the following is accepted:

```json
{
  "settings": {
    "masterVolume": 900,
    "difficulty": "impossible",
    "reducedParticles": "sometimes"
  }
}
```

TypeScript does not protect data read from localStorage.

### Required repair

- Define `SettingsSchema` and `SaveBlobV1Schema` with Zod.
- Clamp numeric ranges and replace invalid enum/boolean values with defaults.
- Either implement keybinds/fullscreen or explicitly move them to a named future sprint and stop marking S9.3 fully accepted.
- Split settings from campaign profile before adding economy data. A single flat blob will become difficult to migrate.

---

## P1-9 — Telemetry fields are defined but not wired

The recorder defines encounter completion and weapon usage methods, but the runtime never calls them. The roadmap also requires damage events and p95 frame timing, neither of which is present.

Current runtime wiring records only:

- deaths;
- multiplier samples when the tier changes;
- projectile peak;
- low-FPS duration.

Sampling multiplier only when it changes does not represent time-weighted average multiplier.

### Required repair

- Add an `onEncounterComplete(id, levelTime)` hook to `EncounterRunner`.
- Record current weapon usage every update, or accumulate on weapon changes using timestamps.
- Record player damage separately from deaths.
- Sample multiplier at a fixed interval or integrate `tier × dt`.
- Add a bounded frame-time buffer and calculate p50/p95/p99 over a defined window.
- Include build version, level ID, difficulty, device profile, run ID, and loadout ID in exported telemetry.
- Do not reset telemetry on checkpoint retry unless the run is intentionally considered a new run.

---

## P1-10 — Stress harness and documented performance evidence are incomplete

The `T` key starts a boss and three formations but does not intentionally saturate projectiles, measure p95 frame time for 30 seconds, or export a benchmark result. The README contains no reference-device measurements.

### Required repair

Create a deterministic benchmark mode with:

- fixed seed;
- fixed duration;
- programmed projectile ramp;
- target counts;
- average/p95/p99 frame time;
- max active enemies and projectiles;
- dropped/failed pool spawns;
- device/browser metadata;
- one-click JSON export.

Do not claim “600 sustained” until the harness directly demonstrates it.

---

## P1-11 — Playwright coverage is below the Epoch 9 contract

Current tests verify:

- MenuScene appears with no console errors;
- Enter reaches GameScene and a player position exists;
- editor title appears.

They do **not** currently verify:

- player movement;
- pause opening/resuming;
- level JSON loaded;
- a 30-second scripted flow;
- no console errors during the second test;
- Results or Game Over transitions;
- gamepad/touch paths;
- deployed base-path behavior.

The test called “keypress starts the game and the player exists” does not test that the player moves.

### Required repair

Expand the E2E handle minimally and safely:

```ts
window.__skyforgeTest = {
  activeScenes,
  playerSnapshot,
  levelSnapshot,
  pauseSnapshot,
  contentErrorCount,
};
```

Gate the handle behind `import.meta.env.DEV || import.meta.env.VITE_E2E === '1'`. Do not expose the full `Phaser.Game` object in normal production builds.

Add tests for title → game → movement → pause → resume, editor preview, and one deployed-base build.

---

## P1-12 — GitHub Pages base path breaks editor navigation and preview

Vite correctly supports `VITE_BASE`, but editor code uses root-absolute URLs:

- `PreviewPanel.tsx`: `/index.html?...`
- `EditorApp.tsx`: `href="/index.html"`

On a project page such as `/repository-name/`, those URLs point to the domain root rather than the repository base.

### Required repair

Construct URLs from `import.meta.env.BASE_URL`:

```ts
const gameUrl = new URL(
  'index.html',
  `${window.location.origin}${import.meta.env.BASE_URL}`,
);
```

Add a build/test using a non-root base, such as `/skyforge/`.

Also make deploy depend on successful CI. The current deploy workflow builds and deploys independently on every push, so a commit can deploy even if tests fail in the separate CI workflow.

---

# 6. Architecture findings before equipment work

## P1-13 — `GameScene` is now 688 lines and continues to absorb responsibilities

It currently coordinates:

- input;
- player lifecycle;
- five object pools;
- weapons;
- collisions;
- score and multiplier;
- level timeline;
- encounters and formations;
- ground objects;
- bosses;
- pickups and drops;
- audio;
- settings feedback;
- pause flow;
- telemetry;
- preview override;
- stress tools;
- touch UI;
- results persistence.

Adding currency, loadout stats, energy, shielding, inventory, and run rewards directly here would create a high-risk god class.

### Required extraction before or at the start of Epoch 10

Recommended boundaries:

```text
GameScene
├── RunSession              score, deaths, checkpoint, mission credits
├── PlayerShipController    player + loadout-derived runtime stats
├── CombatDirector          pools, collisions, weapons, pickups
├── LevelRuntime            timeline, encounters, formations, ground objects
├── BossController          boss lifecycle and collision hooks
├── GamePresentation        particles, shake, flash, audio cues
└── TelemetryBridge         translates runtime events to recorder calls
```

Do not create abstractions merely to reduce line count. Extract around ownership and lifecycle so each system has an explicit `start`, `update`, and `dispose` contract.

---

## P1-14 — Preview still mutates the canonical global registry

`applyPreviewOverride()` replaces `contentRegistry.levels[levelId]`. This global mutation remains after the preview and can make source content and in-memory content disagree.

Introduce a `ContentProvider` or overlay provider. The normal registry should be immutable after validation.

---

## P1-15 — Previous editor integrity issues remain

Before the planned Composer work, resolve these existing issues:

- editor selection is array-index based rather than stable-ID based;
- export proceeds even after validation finds errors;
- autosave uses one global slot rather than one slot per level;
- preview and game links assume root deployment;
- semantic level checks remain incomplete.

These are not equipment blockers, but they should be addressed before the editor becomes a larger authoring platform.

---

# 7. Medium-priority cleanup

## P2-1 — New-high-score display is ambiguous

`recordRun()` updates the saved high score before ResultsScene reads it. Results then displays “NEW HIGH SCORE” whenever `score >= savedHighScore`, including a tied score.

Return a result from `recordRun()`:

```ts
interface RecordRunResult {
  newHighScore: boolean;
  newBestTime: boolean;
  newHighestMultiplier: boolean;
}
```

Pass those flags to ResultsScene.

## P2-2 — Documentation overstates completion

README claims include:

- last-device-wins;
- complete telemetry categories;
- completed performance work;
- accepted gamepad/touch behavior.

The roadmap checkboxes remain unchecked, and README acceptance evidence still refers to Epoch 0. Update completion labels to distinguish:

- implemented;
- automatically verified;
- manually verified;
- deferred.

## P2-3 — Generated-audio implementation has dead fields

`priority` and `musicOsc` are currently unused. Remove dead fields or implement their intended behavior.

## P2-4 — Lint scope excludes E2E and configuration files

`eslint src` does not lint `e2e/`, Playwright config, or Vite config. Expand the lint target once appropriate ignores are configured.

## P2-5 — Review ZIP contains `.git`

Future handoff archives should omit `.git`, `node_modules`, `dist`, `coverage`, `playwright-report`, and `test-results`.

---

# 8. Required Epoch 9R remediation plan for Claude

Treat the following as a release gate before the full Epoch 10 feature set.

## 9R.1 — Scene lifecycle and pause/settings

**Deliverables**

- Fix Pause → Settings → Pause without stopping GameScene.
- Add explicit new-run, restart, checkpoint, and preview state initialization.
- Dispose global listeners, colliders, timers, and audio transitions explicitly.
- Add restart-cycle integration tests.

**Acceptance**

- Pause during boss, change settings, resume with identical runtime state.
- Five repeated deaths/retries produce no duplicated behavior or stale references.

## 9R.2 — Input completion

**Deliverables**

- Enable Phaser gamepad plugin.
- Implement active-device arbitration.
- Make all edge actions genuinely edge-triggered.
- Add reusable menu navigation for gamepad.
- Fix touch button/movement pointer separation and cancellation.
- Apply touch sensitivity.
- Add mobile quality profile.

**Acceptance**

- Complete title → level → pause → results → title using only a gamepad.
- Complete a phone-emulated flow using touch only.

## 9R.3 — Audio correctness

**Deliverables**

- Unlock on the first real gesture.
- Implement pause/visibility-safe music scheduling.
- Wire encounter sound/music events.
- Resolve or remove priority claims.
- Add mock-backed tests.

**Acceptance**

- No pre-gesture audio; first gesture consistently unlocks.
- No queued-note burst after tab restore.
- Pause and resume preserve the intended audio state.

## 9R.4 — Persistence, telemetry, E2E, and deploy

**Deliverables**

- Zod-validate save data.
- Wire all declared telemetry fields.
- Add deterministic benchmark output.
- Expand E2E coverage to movement/pause/content/base path.
- Gate deploy on CI success.
- Fix base-path URLs.

**Acceptance**

- Corrupt and wrong-typed save values recover safely.
- Telemetry export contains plausible nonempty encounter and weapon fields.
- A non-root-base E2E build passes.

## 9R.5 — Architecture extraction

**Deliverables**

- Extract run state, player/loadout boundary, presentation, and telemetry bridge from GameScene.
- Preserve behavior and tests.
- Keep canonical content immutable.

**Acceptance**

- `GameScene` becomes an orchestrator rather than the owner of campaign/economy rules.
- New equipment runtime can be integrated without adding inventory or currency code to `GameScene`.

---

# 9. Recommended roadmap change

The existing roadmap assigns Epoch 10 to the Level Composer. The newly requested Tyrian/Raptor-inspired ship configuration and persistent economy affect the core game loop more deeply than the Composer and should be implemented first.

## Revised order

| Epoch  | Recommended scope                                                                          |
| ------ | ------------------------------------------------------------------------------------------ |
| 9R     | Correct and verify Epoch 9 release features                                                |
| **10** | Ship configuration, persistent profile, currency/economy, hangar, runtime stat integration |
| **11** | Level Composer and map package pipeline                                                    |
| 12     | Campaign expansion, balancing, content production, and final asset integration             |

The Level Composer work is not discarded. It moves one epoch so the campaign loop and player progression contract exist before authoring a larger set of levels.

---

# 10. Claude implementation brief for Epoch 10

Use the separate document **“Ship Configuration, Equipment, Economy, and Progression Addendum — Hybrid Model”** as the product specification.

## Epoch 10.1 — Profile/save v2 and equipment schemas

- Introduce Zod schemas for hulls, primary/secondary weapons, propulsion, generators, shields, armor, and utilities.
- Add persistent profile, inventory, credits, unlocks, and loadouts.
- Migrate v1 settings and records without loss.
- Grant a valid starter ship and starter equipment on migration/new profile.
- Keep combat definitions separate from ownership/economy definitions.

## Epoch 10.2 — Pure loadout validation and derived-stat calculator

- Implement deterministic, order-independent stat calculation.
- Validate ownership, slot compatibility, mass, power, hardpoints, and unique-item rules.
- Return structured errors and comparison deltas.
- Add comprehensive unit/property tests.

## Epoch 10.3 — Currency ledger and mission escrow

- Separate score from credits.
- Add kill/ground-target credit values and money pickups.
- Track banked credits versus current-mission escrow.
- Snapshot escrow at checkpoints to prevent duplicate farming.
- Implement purchase, sale, refund, and rollback transactions.

## Epoch 10.4 — Runtime ship systems

- Create player runtime from an immutable loadout snapshot.
- Integrate armor/hull, rechargeable shields, energy capacity/regeneration, weapon drain, and propulsion-derived movement.
- Preserve current weapon content where possible through adapters.
- Make in-level pickups temporary unless explicitly defined as persistent rewards.

## Epoch 10.5 — Functional Hangar/Shop UI

- Add HangarScene before mission start and after Results.
- Buy, sell, equip, unequip, upgrade, validate, and compare.
- Show credits, power, mass, speed, acceleration, armor, shield, recharge, and estimated weapon output.
- Save multiple named loadouts if scope permits; one active loadout is mandatory.

## Epoch 10.6 — Progression, balancing, telemetry, and full-flow tests

- Tiered unlocks with sidegrades within each tier.
- Mission reward breakdown and unlock presentation.
- Economy telemetry and balancing report.
- End-to-end flow: Title → Hangar → Mission → Results → bank rewards → Hangar.
- Migration and exploit-prevention tests.

---

# 11. Epoch 10 release acceptance criteria

Epoch 10 is not complete until all of the following pass:

1. A v1 save migrates to v2 with settings and records preserved.
2. A new profile always has a legal starter loadout.
3. Invalid or tampered loadouts cannot start a mission.
4. Stat calculation is deterministic and independent of equipment iteration order.
5. Credits and score are separate values with separate UI and persistence.
6. A killed reward source cannot award credits twice after checkpoint retry/seek.
7. Purchases are atomic: failed transactions do not partially mutate credits or inventory.
8. Selling an equipped item either fails clearly or safely equips a legal fallback.
9. Weapon energy depletion and recovery work at 30, 60, and 120 update steps per second.
10. Shield depletion, armor damage, recharge delay, and generator draw behave as specified.
11. Pause, death, retry, Results, and quit preserve or discard mission escrow according to policy.
12. Hangar comparisons accurately reflect the stat calculator.
13. Save/reload reproduces the same inventory, credits, unlocks, and active loadout.
14. Existing level, encounter, boss, and editor content still validates.
15. Typecheck, lint, unit tests, content tests, E2E tests, and production build pass.
16. No final art dependency is introduced; placeholder presentation remains acceptable.

---

## 12. Final instruction to Claude

Do not begin by building a visually elaborate shop. First establish:

1. validated data;
2. deterministic calculations;
3. transactional economy;
4. explicit run/profile lifecycle;
5. runtime integration;
6. tests;
7. then functional UI.

The main architectural failure to avoid is placing persistent profile, inventory, currency, shield regeneration, generator drain, and equipment switching directly inside `GameScene`. Those systems must remain reusable from Hangar, Results, tests, and future campaign screens.
