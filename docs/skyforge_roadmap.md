# Project Skyforge — Iterative Build Roadmap

## Sprint-by-Sprint Implementation Plan for AI-Assisted Development

**Companion document to:** `browser_shmup_PDR.md` (the Bible)
**Version:** 1.0
**Purpose:** Enable a coding model (Claude Opus, Claude Code, etc.) to build the game in small, independently testable sprints. Each sprint produces something you can open in a browser and verify in under 2 minutes.

---

## How to Use This Document

### Per-sprint workflow

1. Open a session with the model. Provide: (a) this roadmap, (b) the PDR, (c) the current state of the repo (or a summary of completed sprints).
2. Say: _"Implement Sprint X.Y exactly as specified. Do not implement anything from later sprints. Do not refactor completed sprints unless the spec requires it."_
3. Run the **Acceptance Test** checklist at the end of the sprint. Every box must pass before moving on.
4. Commit with the sprint ID in the message (e.g., `git commit -m "S2.3: enemy fire + player damage"`).

### Rules for the implementing model (paste these into every session)

- **One sprint per session.** Never implement ahead.
- **No speculative abstraction.** Only build the interfaces this sprint's spec names. Later sprints will refactor when needed — the refactor points are called out explicitly.
- **Placeholder art is mandatory.** Use `Phaser.GameObjects.Graphics`-generated textures (colored rects/circles/triangles) until Sprint 9.x. Never block a sprint on assets.
- **Everything in `src/content/` is JSON. Everything in `src/schemas/` is Zod.** The game must fail loudly (console error + on-screen error text in dev mode) when content fails validation.
- **All magic numbers go in the sprint's named config object**, not inline.
- **Deterministic where possible:** all spawning and movement driven by a single `levelTime` accumulator, not `Date.now()`.

### Global conventions (all sprints)

| Convention           | Value                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Logical resolution   | 540 × 960 portrait, `Phaser.Scale.FIT`, autoCenter `CENTER_BOTH`                                                                 |
| Physics              | Arcade Physics, gravity `{x:0, y:0}`                                                                                             |
| Coordinate origin    | Top-left; enemies enter at negative Y or off-screen X                                                                            |
| Depth layers         | background: 0–9, ground targets: 10, pickups: 20, enemies: 30, player: 40, projectiles: 50, fx: 60, HUD: 100, debug: 200         |
| Collision categories | `PLAYER=1, PLAYER_BULLET=2, ENEMY=4, ENEMY_BULLET=8, PICKUP=16, HAZARD=32` (bitmask constants in `src/game/config/collision.ts`) |
| Time                 | Seconds (float) everywhere in content data; convert from Phaser ms delta once, at the timeline level                             |
| IDs                  | `snake_case` strings; every content file has an `id` field matching its filename                                                 |

---

# EPOCH 0 — Foundation (3 sprints)

Maps to PDR Phase 1 setup. Goal: a running, scaled, linted Phaser 4 + TypeScript app with scene flow.

---

## Sprint 0.1 — Project Scaffold & Render Loop

**Goal:** A page loads in the browser showing a 540×960 game area with a moving test rectangle at 60fps.

**Deliverables:**

1. Vite project: `npm create vite@latest skyforge -- --template vanilla-ts`, then `npm i phaser`.
2. `src/main.ts` boots Phaser with the global scale config above.
3. `src/game/config/gameConfig.ts` exporting the `Phaser.Types.Core.GameConfig` object. `physics: { default: 'arcade' }`, `render: { pixelArt: true }`.
4. One scene `src/game/scenes/GameScene.ts` that draws a filled rect oscillating horizontally via `Math.sin(time)` — proves the update loop runs.
5. FPS counter: `this.game.loop.actualFps` rendered as a `Text` object at depth 200, updated every 500ms (not every frame).
6. `index.html` with a dark page background so the letterboxed game area is visible.

**Technical notes:**

- Verify Phaser 4's current API for scale config; if Phaser 4 is not yet stable on npm at build time, pin Phaser 3.80+ — the PDR architecture is compatible with both, and the model must note which was used in `README.md`.
- Do NOT add React, routing, or the editor yet.

**Acceptance test:**

- [ ] `npm run dev` → browser shows centered portrait game area on a desktop window.
- [ ] Rectangle oscillates smoothly; FPS counter reads ~60.
- [ ] Resizing the browser window keeps the game area letterboxed and centered.
- [ ] `npm run build && npm run preview` also works.

---

## Sprint 0.2 — Tooling, Structure, Test Harness

**Goal:** Repo hygiene that every later sprint depends on. No gameplay changes.

**Deliverables:**

1. ESLint (typescript-eslint, flat config) + Prettier + scripts: `lint`, `format`, `typecheck` (`tsc --noEmit`).
2. Vitest configured; one real test: create `src/shared/mathUtils.ts` with `clamp(v, min, max)` and `angleTo(x1,y1,x2,y2)` (returns radians), plus `mathUtils.test.ts` covering both.
3. Full directory skeleton from PDR §24.3 created with `.gitkeep` files (empty `content/`, `schemas/`, `editor/`, `systems/`, `entities/` etc.).
4. `src/game/config/constants.ts`: `GAME_WIDTH = 540`, `GAME_HEIGHT = 960`, `DEPTHS` object, collision category bitmasks.
5. `README.md`: run/build/test commands + sprint log table (sprint ID, date, status).
6. Git initialized, `.gitignore` for node/vite.

**Acceptance test:**

- [ ] `npm run lint`, `npm run typecheck`, `npm test` all pass clean.
- [ ] Game still runs identically to Sprint 0.1.

---

## Sprint 0.3 — Scene Flow & Input Gate

**Goal:** Boot → Preload → Menu → Game flow. The Menu requires a keypress/click (this is the future audio-unlock gate, PDR §21.1).

**Deliverables:**

1. `BootScene`: sets registry defaults (`debugMode: import.meta.env.DEV`), immediately starts Preload.
2. `PreloadScene`: generates placeholder textures via `Graphics.generateTexture()` — `tex_player` (white triangle, 32×32), `tex_bullet_player` (yellow 4×12 rect), `tex_bullet_enemy` (red 8×8 circle), `tex_enemy_light` (magenta 28×28 rect), `tex_particle` (white 4×4). Shows a fake progress bar (tween 0→100% over 0.5s) to establish the loading UI slot.
3. `MenuScene`: title text + "PRESS ANY KEY / TAP TO START". Any keydown or pointerdown → `scene.start('GameScene')`. Store `audioUnlocked: true` in registry on that interaction.
4. `GameScene`: unchanged test rect, plus `ESC` returns to Menu (temporary — replaced by pause in S9.4).
5. `src/game/scenes/index.ts` exporting the scene array in order.

**Acceptance test:**

- [ ] Refresh → title appears; game does not start on its own.
- [ ] Key press starts GameScene; ESC returns to Menu; can loop repeatedly without console errors.
- [ ] All placeholder textures exist (verify via a temporary debug grid or texture list log).

---

# EPOCH 1 — Player Core (4 sprints)

Maps to PDR §8. Goal: the ship feels good to move and shoot before any enemy exists. **Feel is the acceptance test.**

---

## Sprint 1.1 — Ship Movement & Bounds

**Goal:** 8-direction movement with arcade-style responsiveness, clamped to the play area.

**Deliverables:**

1. `src/game/entities/Player.ts` — class extending `Phaser.Physics.Arcade.Sprite`, using `tex_player`, spawned at `(GAME_WIDTH/2, GAME_HEIGHT - 120)`, depth 40.
2. `src/game/config/playerConfig.ts`:
   ```ts
   export const PLAYER = {
     maxSpeed: 320, // px/s
     focusedSpeed: 160, // px/s, S1.2
     accel: 2400, // px/s^2 (high = arcade feel)
     drag: 2000,
     boundsPadding: 16, // min distance from edge
   };
   ```
3. Movement model: read input as a normalized direction vector; `setAcceleration(dir * accel)`; `setMaxVelocity(maxSpeed)`; `setDrag(drag)`. Diagonals must NOT be faster — normalize the input vector.
4. Clamp with `setCollideWorldBounds(true)` plus a custom bounds rect inset by `boundsPadding`.
5. Keyboard only this sprint: arrows AND WASD both work simultaneously.

**Acceptance test:**

- [ ] Ship reaches full speed in under ~0.15s and stops in under ~0.2s (feels crisp, not floaty).
- [ ] Diagonal speed equals cardinal speed (log velocity magnitude to confirm ≤ maxSpeed + 1).
- [ ] Ship can never leave the padded bounds, even holding a direction into a corner.

---

## Sprint 1.2 — Input Abstraction & Focus Mode

**Goal:** All input flows through one manager so gamepad/touch (S9.2) plug in without touching Player.

**Deliverables:**

1. `src/game/input/InputManager.ts` with per-frame snapshot API:
   ```ts
   interface InputState {
     moveX: number;        // -1..1, already normalized with moveY
     moveY: number;
     firePrimary: boolean;   // held
     fireSecondary: boolean; // held
     special: boolean;       // edge-triggered (justDown)
     focus: boolean;         // held (Shift)
     pause: boolean;         // edge-triggered
   }
   getState(): InputState
   ```
2. Keyboard backend implemented; gamepad/touch stubs returning neutral state, wired but inert.
3. Player consumes `InputState` only — remove direct keyboard reads from Player.
4. Focus mode: while `focus` held, max velocity = `focusedSpeed`, and a small circle (`tex_particle` scaled, radius 4, depth 41) renders at ship center — the future hitbox indicator (PDR §8.2).

**Acceptance test:**

- [ ] Movement identical to S1.1 via the new pathway.
- [ ] Holding Shift halves speed and shows the center dot; releasing restores speed and hides it.
- [ ] `grep` confirms Player.ts contains no `this.input.keyboard` references.

---

## Sprint 1.3 — Primary Fire & Projectile Pool v1

**Goal:** Hold Space → stream of pooled bullets. This pool becomes THE projectile system; get its lifecycle right now.

**Deliverables:**

1. `src/game/entities/Projectile.ts` — `Arcade.Sprite` subclass with:
   ```ts
   fire(cfg: { x: number; y: number; texture: string; vx: number; vy: number;
               damage: number; category: number; lifetime: number }): void
   deactivate(): void   // setActive(false).setVisible(false); body.enable = false
   ```
   `preUpdate` decrements lifetime and deactivates on expiry OR when fully off-screen (position outside a rect inflated 64px beyond the game area).
2. `src/game/systems/PoolManager.ts` — generic wrapper around `Phaser.GameObjects.Group` with `{classType, maxSize, runChildUpdate: true}`; exposes `spawn()`, `activeCount()`, `poolSize()`. Create `playerBulletPool` (maxSize 200).
3. `src/game/systems/WeaponSystem.ts` v1: hardcoded pulse cannon — fireInterval `0.09s`, speed `900` (straight up), damage `10`, single muzzle at `(0, -18)` relative to ship. Cooldown accumulates in seconds from scene delta; firing allowed while `firePrimary` held.
4. Debug text (dev only, depth 200): `bullets active/pooled: N / M`.

**Refactor note for later:** S3.2 replaces the hardcoded weapon with JSON-driven definitions. Keep WeaponSystem's public surface to `update(dt, inputState, muzzleWorldXY)`.

**Acceptance test:**

- [ ] Holding Space fires a steady, even stream; no visible hitching.
- [ ] Bullets vanish above the screen; active count returns to 0 within ~1.5s of releasing fire.
- [ ] Pooled total never exceeds 200 and no new allocations occur after warm-up (verify: active+inactive stable in debug text).
- [ ] Fire rate is framerate-independent (throttle to 30fps via devtools → same bullets/second).

---

## Sprint 1.4 — Scrolling Background

**Goal:** Two-layer vertical parallax establishing motion and the depth-layer discipline.

**Deliverables:**

1. Generate two tileable placeholder textures in Preload: `tex_bg_far` (very dark blue with sparse dim stars), `tex_bg_near` (transparent with brighter stars), each 540×960, built with Graphics + random points (seeded RNG in `src/shared/rng.ts` — a tiny mulberry32 implementation, unit-tested).
2. Two `TileSprite`s covering the screen at depths 0 and 5; scroll speeds `20` and `60` px/s via `tilePositionY -= speed * dt`.
3. `src/game/systems/ScrollController.ts` owning a `scrollSpeedMultiplier` (default 1) — encounters change this later (PDR §13.1 "Change background speed").

**Acceptance test:**

- [ ] Both layers scroll continuously; near layer visibly faster (parallax reads clearly).
- [ ] Player and bullets render above both layers.
- [ ] FPS still ~60 with fire held.

---

# EPOCH 2 — First Combat Loop (5 sprints)

Maps to PDR Phase 1 exit condition: _move, shoot, destroy enemies, take damage, restart._

---

## Sprint 2.1 — Enemy Entity & Pool

**Goal:** Enemies spawn on a timer, descend, despawn off-screen. No combat yet.

**Deliverables:**

1. `src/game/entities/Enemy.ts` — Arcade.Sprite subclass with lifecycle mirroring PDR §9.3:
   ```ts
   activate(cfg: { x: number; y: number; texture: string; health: number;
                   speed: number; scoreValue: number; hitboxRadius: number }): void
   deactivate(): void
   ```
   Circular body: `setCircle(hitboxRadius, offsetX, offsetY)` centered on the sprite.
2. `enemyPool` via PoolManager (maxSize 64).
3. Temporary spawner in GameScene: every 1.2s spawn one enemy at random X (60..480), y = −40, velocity `(0, +130)`, health 20 — matching the PDR `light_fighter` numbers.
4. Despawn 64px below the bottom edge.
5. Debug text extended: `enemies active/pooled`.

**Acceptance test:**

- [ ] Steady stream of descending enemies; counts rise and fall correctly.
- [ ] Leave running 3 minutes → pool size stable, no memory growth in devtools performance monitor.

---

## Sprint 2.2 — Player Bullets vs Enemies

**Goal:** Shooting kills. Includes hit feedback because feedback IS the feature.

**Deliverables:**

1. `src/game/systems/CollisionSystem.ts`: registers `physics.add.overlap(playerBulletPool.group, enemyPool.group, onHit)`. Guard: ignore pairs where either object is inactive.
2. On hit: deactivate bullet; `enemy.takeDamage(dmg)`.
3. `Enemy.takeDamage`: subtract; **hit flash** — `setTintFill(0xffffff)` for 40ms (tracked via a flash timer in preUpdate, not `setTimeout`); at ≤0 → `explode()`.
4. `explode()`: deactivate + burst of 8 `tex_particle` particles (one shared `ParticleEmitter` at depth 60, `explode(8, x, y)` mode — no per-enemy emitters).
5. `src/game/systems/ScoreSystem.ts`: `addKill(scoreValue)`; plain score text top-left at depth 100 (HUD proper comes in S2.4 — keep this minimal).

**Acceptance test:**

- [ ] Two pulse hits (10+10 vs 20hp) kill a light fighter; flash visible on first hit.
- [ ] Explosion burst renders at the enemy's death position.
- [ ] Score increments by 100 per kill.
- [ ] Bullets that miss pass through nothing and expire normally; no hits registered from inactive objects (spam-check console for errors).

---

## Sprint 2.3 — Enemy Fire, Player Damage, Death & Restart

**Goal:** Close the loop: the game can now be lost.

**Deliverables:**

1. `enemyBulletPool` (maxSize 500) reusing Projectile.
2. Enemies fire one **aimed** shot every 2.0s (first shot after 0.8s): compute angle to player with `angleTo`, speed 180, damage 1, texture `tex_bullet_enemy`.
3. Player hitbox per PDR §8.2: circle radius **5** at ship center (much smaller than the 32px sprite). Set via `setCircle` with correct offset.
4. Player damage model per PDR §8.3: `hull = 3`; on enemy-bullet overlap or enemy-body overlap → `hull -= 1` (collisionDamage), deactivate the bullet, grant **1.0s invulnerability** (i-frames): body ignores damage overlaps + sprite alpha blinks at 10Hz.
5. Death: hull 0 → hide player, stop input, 8-particle burst, 1s delay → `GameOverScene` (new minimal scene: "GAME OVER — score N — press key to retry" → restarts GameScene fresh).
6. Registry-based `debugInvulnerable` flag (toggled with `I` key in dev) for future testing.

**Acceptance test:**

- [ ] Enemy shots visibly track your position at fire time (move → next shot aims at new position).
- [ ] Grazing a bullet with the ship's wings does NOT damage you; center contact does (hitbox is small).
- [ ] After a hit: blink for 1s, immune during blink, vulnerable after.
- [ ] Three hits → game over screen → retry gives a clean fresh run (score 0, hull 3, pools reset).
- [ ] `I` key toggles invulnerability in dev.

---

## Sprint 2.4 — HUD v1

**Goal:** Dedicated HUD layer per PDR §19.1, replacing ad-hoc text.

**Deliverables:**

1. `src/game/ui/Hud.ts` — a container at depth 100 owning: hull pips (3 small ship icons top-left), score (top-right, zero-padded 8 digits), weapon name + level placeholder (bottom-left, shows "PULSE Lv1"), multiplier placeholder (top-center, hidden until S5.5).
2. Event-driven: GameScene emits `hud:hull`, `hud:score`, `hud:weapon` on a scene-level `Phaser.Events.EventEmitter`; Hud subscribes. No polling.
3. Hull pips grey out (alpha 0.25) when lost; brief scale-punch tween on score change.

**Acceptance test:**

- [ ] Hull pips track damage; score updates with punch effect; no HUD element overlaps the top 60px of gameplay-critical space awkwardly.
- [ ] After restart, HUD is fully reset.

---

## Sprint 2.5 — Debug Overlay & Dev Controls

**Goal:** The developer console the rest of the project relies on (PDR §29).

**Deliverables:**

1. `src/game/debug/DebugOverlay.ts` (only constructed when `debugMode`): toggled with backtick. Shows: FPS, frame ms, active/pooled counts for all pools, level time (stub 0 until S4.4), current encounter name (stub).
2. Hitbox rendering: `H` key toggles `physics.world.drawDebug` + debug graphic.
3. Time controls: `[` / `]` set `this.physics.world.timeScale` and a global `timeScale` applied to all dt-based systems (0.25 / 0.5 / 1 / 2 steps). Everything must respect it — this catches any system secretly using real time.
4. `K` key: kill all active enemies (for fast iteration).

**Acceptance test:**

- [ ] Slow motion at 0.25× slows bullets, enemies, fire cooldowns, i-frame timers, and particle motion uniformly.
- [ ] Hitbox view shows: tiny player circle, enemy circles, bullet bodies.
- [ ] Overlay has no measurable FPS cost when hidden.

---

# EPOCH 3 — Data-Driven Definitions (5 sprints)

Maps to PDR Phase 2. Exit condition: _new enemy and weapon variants can be created primarily through data._

---

## Sprint 3.1 — Schemas, Content Loader, Enemy JSON

**Goal:** Enemies defined in JSON validated by Zod; hardcoded enemy config deleted.

**Deliverables:**

1. `npm i zod`. `src/schemas/enemySchema.ts` matching PDR §9.1 exactly:
   ```ts
   export const EnemySchema = z.object({
     id: z.string(),
     displayName: z.string(),
     sprite: z.string(),
     health: z.number().positive(),
     collisionDamage: z.number().nonnegative(),
     scoreValue: z.number().nonnegative(),
     movementPattern: z.string(),
     weaponPattern: z.string().nullable(),
     speed: z.number(),
     hitbox: z.object({ type: z.literal('circle'), radius: z.number().positive() }),
     drops: z
       .array(z.object({ pickup: z.string(), chance: z.number().min(0).max(1) }))
       .default([]),
   });
   ```
2. `src/game/systems/ContentRegistry.ts`: loads all JSON via `import.meta.glob('/src/content/**/*.json', { eager: true })`, validates each file against the schema for its folder, stores in typed Maps, and collects a `ValidationError[]` list (file, message).
3. Dev-mode error surface: if any errors, GameScene renders a red error panel listing them (this is the PDR §23.2 "show errors" requirement, game-side).
4. `src/content/enemies/light_fighter.json` — the PDR example verbatim (movementPattern `straight_descent` for now; sine comes in S3.4).
5. Spawner + Enemy.activate now take an enemy **id** and pull stats from the registry. Weapon pattern string is stored but still ignored (S3.3 wires it).
6. Unit tests: valid file parses; missing `health` fails; negative radius fails.

**Acceptance test:**

- [ ] Game plays identically to S2.5 but zero enemy stats appear in `.ts` files (grep `health: 20` → only JSON).
- [ ] Corrupt the JSON (delete a field) → red in-game error panel names the file and field; game doesn't silently crash.

---

## Sprint 3.2 — Weapon Definitions & Weapon Levels

**Goal:** Pulse cannon from JSON with 3 upgrade levels; WeaponSystem becomes generic.

**Deliverables:**

1. `src/schemas/weaponSchema.ts` per PDR §8.4:
   ```ts
   z.object({
     id: z.string(),
     displayName: z.string(),
     projectileTexture: z.string(),
     collisionCategory: z.enum(['player', 'enemy']),
     levels: z
       .array(
         z.object({
           damage: z.number(),
           fireInterval: z.number().positive(),
           projectileSpeed: z.number(),
           projectileCount: z.number().int().min(1),
           spreadAngles: z.array(z.number()), // degrees, len == projectileCount
           muzzles: z.array(z.tuple([z.number(), z.number()])), // relative offsets
         }),
       )
       .min(1),
   });
   ```
2. `src/content/weapons/pulse_cannon.json`: L1 = current behavior; L2 = two muzzles `[-8,-14],[8,-14]`, interval 0.09; L3 = two muzzles + interval 0.07, damage 12.
3. WeaponSystem v2: `equip(weaponId)`, `setLevel(n)` (clamped to defined levels), fires per the level row — for each muzzle × each spread angle, spawn one projectile with velocity rotated by the angle.
4. Dev keys: `1`/`2`/`3` set weapon level. HUD weapon text reflects it.

**Acceptance test:**

- [ ] L1/L2/L3 visibly differ exactly as defined; DPS increases each level.
- [ ] Adding a hand-written L4 row to the JSON works with zero code changes.

---

## Sprint 3.3 — Enemy Projectile Patterns

**Goal:** Reusable enemy fire patterns per PDR §10.2; enemies reference them by id.

**Deliverables:**

1. `src/schemas/projectilePatternSchema.ts`:
   ```ts
   z.object({
     id: z.string(),
     projectileTexture: z.string(),
     count: z.number().int().min(1),
     angles: z.array(z.number()), // degrees; special string "aimed" handled by aim:true
     aimed: z.boolean().default(false), // if true, angles are offsets from the player-aim angle
     speed: z.number().positive(),
     cooldown: z.number().positive(),
     firstShotDelay: z.number().nonnegative().default(0.8),
     damage: z.number().default(1),
   });
   ```
2. Content: `single_aimed_shot.json` (count 1, aimed, offsets `[0]`, speed 180, cooldown 2.0), `five_way_spread.json` (PDR example verbatim, aimed:false, angles measured from straight-down), `three_way_aimed.json` (aimed, offsets `[-15,0,15]`, speed 200, cooldown 1.6).
3. `src/game/systems/EnemyWeapon.ts`: per-enemy component instantiated on activate from the pattern id; owns its cooldown; fires via enemyBulletPool.
4. `light_fighter.json` uses `single_aimed_shot`. Temporary spawner alternates a variant enemy inline-overridden to `five_way_spread` so both are visible.
5. Unit test: pattern math — given angles `[-30,-15,0,15,30]` and speed 180, assert the 5 velocity vectors.

**Acceptance test:**

- [ ] Two visibly distinct fire behaviors on screen driven purely by JSON ids.
- [ ] Editing `cooldown` in JSON + reload changes fire rate with no code change.

---

## Sprint 3.4 — Movement Pattern System (core set)

**Goal:** Parameterized movement per PDR §11: straight descent, sine descent, diagonal sweep, side-to-side patrol.

**Deliverables:**

1. `src/schemas/movementSchema.ts` — discriminated union on `type`:
   - `straight`: `{ angleDeg (default 90=down), speed }`
   - `sine`: `{ verticalSpeed, horizontalAmplitude, frequency, duration? }` (PDR example verbatim)
   - `sweep`: `{ fromSide: 'left'|'right', angleDeg, speed }`
   - `patrol`: `{ y, horizontalSpeed, leftX, rightX, entrySpeed }`
2. `src/game/systems/MovementRunner.ts`: pure function per pattern type —
   `step(state, def, dt): { x, y, done }` where `state` holds `t`, origin, and per-type scratch. **Position-based, not velocity-based** (deterministic; velocity set to 0, positions written directly). Unit-testable without Phaser: assert sine x-position at t=0, quarter period, half period.
3. Enemy owns a `MovementState`; `preUpdate` advances it; `done` (duration elapsed or exited screen) triggers deactivate/exit behavior.
4. Content files for all four; `light_fighter` switched to `sine_descent` (PDR example values).
5. `patrol` clamps within `[leftX, rightX]` and reverses; enters from top at `entrySpeed` until reaching `y`.

**Acceptance test:**

- [ ] Four spawn-key debug bindings (`F1..F4`) each spawn one enemy demonstrating one pattern; all visually correct.
- [ ] Sine enemies still fire aimed shots correctly while weaving.
- [ ] Unit tests pass for sine math and patrol reversal.

---

## Sprint 3.5 — Movement Patterns (advanced set)

**Goal:** The remaining PDR §11 patterns needed for the vertical slice content.

**Deliverables:**

1. Add to the union + runner:
   - `bezier`: `{ points: [x,y][] (4 control points, relative to spawn), duration }` — implement cubic Bézier evaluation in `mathUtils` (unit test t=0, 0.5, 1).
   - `dive_retreat`: `{ diveTargetYOffset, diveSpeed, pauseDuration, retreatSpeed }` — dive toward player's X at trigger time, pause, retreat upward off-screen.
   - `stop_and_fire`: `{ entrySpeed, stopY, holdDuration, exitAngleDeg, exitSpeed }` — the bomber/heavy pattern; while holding, EnemyWeapon cooldown multiplier ×0.5 (fires faster when parked).
   - `enter_attack_exit`: `{ enter: {fromSide, targetX, targetY, speed}, holdDuration, exit: {angleDeg, speed} }` — the interceptor pattern.
2. `orbit_point` and `follow_leader` are **deferred to a stretch sprint** (not needed by slice content; note this in README).
3. Debug bindings `F5..F8`.

**Acceptance test:**

- [ ] Each of the four new patterns demonstrably correct via debug keys.
- [ ] `stop_and_fire` enemy visibly parks, fires rapidly, then leaves along its exit angle.
- [ ] Bézier unit tests pass.

---

# EPOCH 4 — Formations, Encounters, Timeline (5 sprints)

Maps to PDR Phase 3. Exit condition: _a complete three-minute level runs from a data file._

---

## Sprint 4.1 — Formation Spawner

**Goal:** Spawn coordinated groups from JSON per PDR §12.

**Deliverables:**

1. `src/schemas/formationSchema.ts`:
   ```ts
   z.object({
     id: z.string(),
     movement: z.string(), // shared default
     members: z
       .array(
         z.object({
           enemy: z.string(),
           offsetX: z.number(),
           offsetY: z.number(),
           delay: z.number().nonnegative().default(0),
           movementOverride: z.string().optional(),
           fireDelay: z.number().nonnegative().default(0),
         }),
       )
       .min(1),
   });
   ```
2. `src/game/systems/FormationSpawner.ts`: `spawn(formationId, originX, originY): FormationInstance`. Schedules each member at `levelTime + delay`; each enemy's MovementState origin = origin + offsets; `fireDelay` adds to the pattern's `firstShotDelay`.
3. `FormationInstance` tracks its members and exposes `isCleared()` (all destroyed) and `isDone()` (all destroyed or exited) — encounter completion (S4.3) depends on this distinction.
4. Content: `v_scouts.json` (PDR example verbatim) + `horizontal_row.json` (5 light fighters, offsets X −160..160 step 80, delay 0).
5. Registry validation extended: formation member `enemy` and `movement` ids must exist (reference checking, PDR §33).

**Acceptance test:**

- [ ] Debug key spawns `v_scouts`: 5 fighters enter in V arrangement with staggered 0.15s delays, all weaving in formation-relative sine.
- [ ] Killing all 5 flips `isCleared()` (log it).
- [ ] A formation referencing a missing enemy id produces a load-time validation error, not a runtime crash.

---

## Sprint 4.2 — Formation Library Complete

**Goal:** All six PDR §12.2 formations as content, plus the enemies they need.

**Deliverables:**

1. New enemy JSON (stats are starting points for balancing):
   - `heavy_fighter.json`: health 80, speed 70, `stop_and_fire` movement, `three_way_aimed`, score 400, radius 20, drops `[{pickup:"weapon_upgrade", chance:0.5}]` (pickup inert until S5.3 — registry must tolerate forward references to the pickups folder with a warning, not an error, until then; simplest: add the pickup schema + `weapon_upgrade.json` stub now).
   - `interceptor.json`: health 15, speed 260, `enter_attack_exit`, `single_aimed_shot`, score 150, radius 12.
2. Formation content: `left_sweep.json`, `right_sweep.json` (alternating sweep pair using `sweep` movement), `staggered_column.json`, `pinch_attack.json` (interceptors from both sides simultaneously), `escort_heavy.json` (1 heavy fighter center + 4 light fighters at corner offsets, lights use `movementOverride: sine_descent`).
3. Debug: number-row keys spawn each formation for tuning.

**Acceptance test:**

- [ ] All 6 formations spawn correctly from debug keys and read as distinct tactical situations.
- [ ] Escort: killing the heavy first vs. lights first both behave sanely.
- [ ] Pinch attack creates genuine crossfire pressure at center screen.

---

## Sprint 4.3 — Encounter Runner

**Goal:** The reusable encounter unit per PDR §13 — timed events + completion conditions.

**Deliverables:**

1. `src/schemas/encounterSchema.ts`: `id`, `estimatedDuration`, `difficulty (1-5)`, `skillsTested: string[]`, `events: EncounterEvent[]`, `completion: { type: 'duration' | 'allClear' | 'flag', flag?: string }`.
   Event union (implement NOW): `spawnFormation {at, formation, x, y}`, `spawnEnemy {at, enemy, x, y, movementOverride?}`, `wait_for_clear {at}` (blocks subsequent events until all encounter-spawned enemies are cleared), `setScrollSpeed {at, multiplier}`, `spawnPickup {at, pickup, x, y, condition?}` (condition evaluation stubbed to always-true until S5.3), `setFlag {at, flag}`.
   Event types deferred with explicit stubs that log a warning: `triggerDialogue`, `playSound`, `playMusicCue` (S9.1), `startMiniboss`/`startBoss` (S6.x), `setCheckpoint` (S4.4), `spawnHazard` (S5.6), `activateGroundTarget` (S4.5).
2. `src/game/systems/EncounterRunner.ts`: `start(encounterId)`; advances an internal clock; fires events at their `at` times (handles multiple events in one frame, in order); tracks all entities it spawned; `isComplete()` per the completion rule; supports several concurrent encounters (timed overlap, PDR §13.3).
3. Content: `opening_scouts.json` — 3 waves: `v_scouts` at t=0, `horizontal_row` at t=4, `v_scouts` at t=8 with different x; completion `allClear`.
4. Debug overlay shows active encounter id(s) + their clocks.

**Acceptance test:**

- [ ] Debug key runs `opening_scouts`: waves appear at 0/4/8s; encounter reports complete only when every ship is destroyed or exited.
- [ ] `wait_for_clear` verified with a test encounter: second formation does not spawn until the first is cleared.
- [ ] Two encounters started simultaneously run independently without cross-talk.

---

## Sprint 4.4 — Level Timeline, Checkpoints, Seek

**Goal:** A level as a scheduled sequence of encounters per PDR §14, with the debug seeking that makes all later content work fast.

**Deliverables:**

1. `src/schemas/levelSchema.ts` per PDR §14.3: `id`, `displayName`, `music (string, unused yet)`, `durationTarget`, `events: [{at, encounter} | {at, type:'recovery', duration} | {at, type:'checkpoint', name}]`.
2. `src/game/systems/LevelTimeline.ts`: owns THE `levelTime` clock (the one true clock all systems already read); starts encounters at their times; `recovery` simply reduces scroll multiplier to 0.8 and guarantees no spawns for its duration.
3. Checkpoints: `checkpoint` events record `{name, at}`. On player death, offer "Retry from checkpoint" (restart timeline at the checkpoint's `at` with full hull, weapon level preserved) or "Restart level". Skip-to-checkpoint dev key `C` cycles checkpoints.
4. Debug seek: `,` / `.` jump levelTime ±10s — on any seek, hard-clear all active enemies/bullets/encounters, then fast-scan the timeline to start whatever should be active. This is PDR §14.1 "seek to a testing timestamp."
5. Content: `level_dev.json` — opening_scouts at t=2, a second encounter `crossfire_intro.json` (left_sweep + right_sweep overlapping, new content) at t=20, checkpoint at t=18.
6. Replace the temporary GameScene spawner entirely: **from this sprint on, nothing spawns except via the timeline or debug keys.**

**Acceptance test:**

- [ ] Fresh run of `level_dev` plays both encounters at the right times with a calm gap.
- [ ] Die during encounter 2 → checkpoint retry restarts at t=18 cleanly.
- [ ] Seek forward/back repeatedly → no orphaned enemies, duplicated encounters, or console errors.
- [ ] Debug overlay levelTime matches scheduled event times.

---

## Sprint 4.5 — World-Position Triggers & Ground Turret

**Goal:** The second authoring axis per PDR §14.2: things attached to the scrolling world.

**Deliverables:**

1. `src/game/systems/WorldScroll.ts`: converts levelTime → world scroll distance (`distance = ∫ baseScrollSpeed * multiplier dt`); ground objects are placed at a `worldY` and rendered at `screenY = worldY - distance` (appearing from the top).
2. `src/game/entities/GroundTarget.ts`: turret per PDR §9.2 — static sprite (new `tex_turret`, dark green 32×32), depth 10, health 60, activates (begins firing `three_way_aimed` with a rotating visual barrel line) when its screenY enters the viewport + 32px; destructible; score 250; does NOT collide with the player (it's on the ground plane) — only its bullets do.
3. Level schema extended: `groundObjects: [{type:'turret', worldY, x, id}]`.
4. Seek support: seeking recomputes scroll distance and places/activates ground objects correctly.
5. Add 3 turrets to `level_dev.json` between the two encounters.

**Acceptance test:**

- [ ] Turrets scroll into view attached to the background motion, activate on entry, fire, and can be destroyed for score.
- [ ] Player flying over a turret takes no collision damage; turret bullets still hurt.
- [ ] Seek to just before/after a turret's position behaves correctly both directions.

---

# EPOCH 5 — Content Systems Breadth (6 sprints)

Maps to PDR Phase 5 systems. Each sprint stays independently testable via `level_dev.json` + debug keys.

---

## Sprint 5.1 — Bomber & Area Denial

**Deliverables:**

1. `bomber.json`: health 120, speed 45, `stop_and_fire` (stopY 180, hold 6s), score 500, radius 24, new pattern `ring_burst.json` (count 12, angles 0..330 step 30, aimed:false, speed 120, cooldown 2.5) — slow bullet rings that deny space.
2. Mine mechanic: bombers also drop a `mine` every 2s while holding — implement as an enemy-category projectile with speed 0, lifetime 8s, radius 10, damage 1, that pulses alpha; add `dropsMines: boolean` to... **no** — keep schemas clean: implement as a second EnemyWeapon slot. Extend enemy schema: `weaponPattern: string | string[]` (array = multiple concurrent patterns); add pattern `mine_drop.json` (count 1, angle 90, speed 0, cooldown 2.0, lifetime override). Extend projectile pattern schema with optional `lifetime`.
3. Formation `bomber_escort.json`: bomber + 2 interceptors.

**Acceptance test:**

- [ ] Bomber parks, emits rings and stationary pulsing mines; mines expire after 8s.
- [ ] Multiple weapon patterns fire concurrently on one enemy, each with its own cooldown.

---

## Sprint 5.2 — Pickups & Drop Resolution

**Goal:** PDR §17 pickups + §9.3 drop resolution.

**Deliverables:**

1. `src/schemas/pickupSchema.ts`: `id`, `texture`, `effect: 'weapon_upgrade' | 'shield'`, `magnitude`, `fallSpeed (default 60)`, `lifetime (default 10)`.
2. `src/game/entities/Pickup.ts` + pool: drifts downward, gentle sine sway (±10px), collected on player overlap (generous radius 24 — pickups should feel magnetic, not precise).
3. Effects: `weapon_upgrade` → `WeaponSystem.setLevel(level+1)` with a screen-flash-free but audible/visual pop (scale tween + particle ring); `shield` → +1 hull up to max 3 (over-cap converts to +500 score).
4. Drop resolution on enemy death: roll each entry in `drops` independently.
5. Encounter `spawnPickup` condition now real: conditions are flags set via `setFlag` or auto-flags the runner sets (`<enemyId>_destroyed` when an encounter kills its last member of that type — implement just the `heavy_fighter_destroyed` style auto-flag per the PDR §13.2 example).
6. HUD: weapon level text live-updates.

**Acceptance test:**

- [ ] Heavy fighters drop upgrades ~50% of the time; collecting one upgrades pulse L1→L2→L3; L3 collection gives score instead.
- [ ] Shield pickup restores a hull pip; at full hull gives score.
- [ ] Uncollected pickups fade out at lifetime end.

---

## Sprint 5.3 — Spread Cannon & Weapon Switching

**Deliverables:**

1. `spread_cannon.json`: L1 = 3 projectiles, angles `[-12,0,12]`, damage 6, interval 0.14; L2 = 5 projectiles `[-24,-12,0,12,24]`; L3 = 5 projectiles, interval 0.11, damage 7.
2. Weapon switching: pickups now carry `weapon?: string` — a `pickup_spread.json` swaps the equipped primary (level carries over, clamped). Dev key `Q` toggles weapons directly.
3. WeaponSystem: verify switching mid-fire has no cooldown exploit (cooldown persists across switch).

**Acceptance test:**

- [ ] Both weapons at all levels behave per data; switching preserves level and doesn't reset cooldown to 0.

---

## Sprint 5.4 — Missile System (Secondary)

**Goal:** PDR §8.4 weapon 3 with homing per §10.1.

**Deliverables:**

1. Projectile homing: extend Projectile with optional `homing: { turnRateDegPerSec, acquireDelay }` — after acquireDelay, each frame steer velocity toward nearest active enemy by ≤ turnRate·dt; if no target, fly straight. Unit-test the steering math (angle-wrap correctness).
2. `missile_system.json` (secondary slot): 1 level to start — damage 40, interval 1.5s, speed 340, turnRate 140°/s, acquireDelay 0.15s, new `tex_missile` (orange 6×14) + small particle trail (shared emitter, follow mode).
3. WeaponSystem gains a secondary slot driven by `fireSecondary`; HUD shows secondary cooldown as a small radial or bar bottom-right.

**Acceptance test:**

- [ ] Missiles visibly curve into moving enemies; with no enemies they fly straight off-screen.
- [ ] Secondary cooldown bar accurate; primary fire unaffected while missiling.

---

## Sprint 5.5 — Score Multiplier

**Goal:** PDR §18 multiplier meter, exactly as specified.

**Deliverables:**

1. `src/game/systems/MultiplierSystem.ts` with config object:
   ```ts
   { meterPerKill: 0.2, decayDelay: 2.5, decayRate: 0.35/s,
     damagePenalty: 1.0 /* full meter loss */, tiers: [1, 2, 3, 4, 5] }
   ```
   Meter 0..1 within the current tier; filling advances tier, emptying drops tier. Kills add meter; taking damage clears meter and drops one tier; inactivity > decayDelay drains at decayRate. All kill score ×= tier.
2. HUD multiplier: top-center `×N` with a thin meter bar; tier-up punch tween; turns red while decaying.
3. Rapid-group-destruction bonus: killing 3+ enemies within 0.6s adds a flat `+tier×50` bonus (covers the PDR "bonus for rapid group destruction").
4. Unit tests: kill/decay/damage transitions across tier boundaries.

**Acceptance test:**

- [ ] Aggressive continuous play sustains ×3–×4; camping decays to ×1; getting hit visibly drops the tier.
- [ ] Score deltas reflect the multiplier (verify with debug logging).

---

## Sprint 5.6 — Environmental Hazard: Minefield

**Deliverables:**

1. Encounter event `spawnHazard {at, hazard, ...params}` implemented for one hazard type: `minefield` — spawns `count` mines (reusing S5.1 mines, longer lifetime 20s) in a poisson-ish scatter across a rect `{x,y,w,h}`, drifting downward at scroll speed so they feel world-attached.
2. Mines are shootable: give them 1 health and an enemy-category body (score 10 each) — requires mines to be Enemy-pool entities, not projectiles; refactor S5.1 mine_drop accordingly (bomber drops now spawn a `mine.json` enemy with `straight` movement speed 0). This unifies mines and removes the projectile-lifetime special case.
3. `minefield.json` encounter: scroll slows to 0.7, mines scatter, one shield pickup mid-field, completion `duration`.

**Acceptance test:**

- [ ] Minefield section plays as a navigation puzzle; mines are shootable for points; shield reachable with careful movement.
- [ ] Bomber mines still work after the refactor.

---

# EPOCH 6 — Bosses (3 sprints)

Maps to PDR §16. The boss framework reuses movement/pattern systems — bosses are choreography, not new tech.

---

## Sprint 6.1 — Boss Framework

**Deliverables:**

1. `src/schemas/bossSchema.ts`:
   ```ts
   z.object({
     id: z.string(),
     displayName: z.string(),
     sprite: z.string(),
     totalHealth: z.number().positive(),
     hitboxRadius: z.number(),
     phases: z
       .array(
         z.object({
           name: z.string(),
           healthThreshold: z.number().min(0).max(1), // phase active while hp% > threshold
           movement: z.string(),
           weaponPatterns: z.array(z.string()),
           parts: z
             .array(
               z.object({
                 // destructible components
                 id: z.string(),
                 offsetX: z.number(),
                 offsetY: z.number(),
                 health: z.number(),
                 radius: z.number(),
                 weaponPattern: z.string().optional(),
                 scoreValue: z.number(),
               }),
             )
             .default([]),
           telegraphDuration: z.number().default(1.0), // pause+flash before phase begins
         }),
       )
       .min(1),
     enrage: z
       .object({ afterSeconds: z.number(), cooldownMultiplier: z.number() })
       .optional(),
     defeatDuration: z.number().default(2.5),
   });
   ```
2. `src/game/entities/Boss.ts` + `src/game/systems/BossController.ts`: spawns off-screen top, enters to y=140; phase = first row whose threshold < current hp%; on phase change: clear boss bullets, telegraph (tint pulse + brief hold), then apply new movement/patterns; destructible parts are child bodies (manual circle checks vs player bullets — parts don't need arcade bodies) that stop firing when destroyed; enrage multiplies all cooldowns after the timer; defeat = multi-explosion sequence over `defeatDuration`, big score, encounter completion signal.
3. Encounter events `startMiniboss` / `startBoss {at, boss}` implemented: encounter completes when boss defeated; timeline **pauses further level events** while a boss encounter gates (strict gate per PDR §13.3).
4. Boss health bar in HUD (top, appears on boss start, drains smoothly with a lagging damage ghost).
5. Dev key `B` force-advances boss phase (PDR §29).

**Acceptance test:**

- [ ] A 2-phase test boss JSON runs: enters, fights, telegraphs at threshold, changes behavior, dies with sequence; health bar + ghost correct.
- [ ] Destroying a part stops that part's fire and awards score; main hitbox still takes damage.
- [ ] `B` key skips phases cleanly.

---

## Sprint 6.2 — Miniboss Alpha

**Deliverables:**

1. `miniboss_alpha.json`: 2 phases, ~600 hp, patrol movement; P1 `three_way_aimed` + slow `ring_burst`; P2 (≤50%) faster patrol + `five_way_spread` with reduced cooldown; no parts; enrage at 45s.
2. Encounter `miniboss_alpha.json` wrapping it, preceded by 2s of empty calm (tension beat).
3. Balance pass: target 25–40s fight for a competent player at weapon L2 (tune hp/cooldowns; record actual times in README sprint log).

**Acceptance test:**

- [ ] Fight is beatable, readable, and the phase shift is obvious; bullet density never fully seals movement space.

---

## Sprint 6.3 — Boss Alpha (3 phases)

**Goal:** PDR §16.2 structure exactly.

**Deliverables:**

1. `boss_alpha.json`: ~1800 hp.
   - **P1** (>66%): slow patrol; alternating aimed volleys (`three_way_aimed` with generous cooldown); large exposed hitbox.
   - **P2** (66–33%): deploys 2 side-turret **parts** (each 150hp, `single_aimed_shot` fast cooldown); main body adds a sweeping fan — new pattern `sweep_fan.json` (count 3, aimed:false, angles animated: implement pattern schema extension `angleSweep: {from, to, period}` that rotates the whole pattern over time).
   - **P3** (≤33%): faster movement; combines aimed volleys + `ring_burst` (the pattern the level taught via bombers, per PDR "uses a pattern previously introduced").
2. `angleSweep` unit-tested.
3. Defeat → results flow: on boss death, 2.5s celebration, then `ResultsScene` (new): score, max multiplier, time, deaths, "Press key → Menu".

**Acceptance test:**

- [ ] Full 3-phase fight per spec; side turrets independently destroyable and worth destroying.
- [ ] Sweeping fan reads as a moving wall requiring repositioning.
- [ ] Victory reaches Results with correct stats.

---

# EPOCH 7 — The Level (2 sprints)

Maps to PDR Phase 5 exit: _the level is playable start to finish and ready for balancing._

---

## Sprint 7.1 — Level 01 Full Assembly

**Deliverables:**

1. Build the remaining encounters to reach 10–15 total (PDR §7), following §5.3's introduce→practice→combine→test and §5.4 pacing. Target list (times per PDR §14.3 example, tuned to fit):
   `opening_scouts`, `turret_introduction`, `crossfire_combination`, `interceptor_ambush`, `heavy_escort_push`, `bomber_wall`, `miniboss_alpha`, `recovery_reward` (pickup shower, no enemies), `minefield`, `pinch_gauntlet`, `mixed_assault`, `final_escalation`, `boss_alpha`. Each encounter JSON must fill `difficulty`, `skillsTested`, `estimatedDuration` honestly — the editor graphs these later.
2. `level_01.json` ("Coastal Approach") assembling all of it, 3.5–4.5 min, checkpoints before miniboss, after minefield, before boss.
3. Ground turrets placed via `groundObjects` through the first half.
4. Intensity audit: README table listing each encounter's time, difficulty, and skills — verify no skill repeats back-to-back (PDR §33 repetition mitigation) and intensity follows wave/recovery shape.

**Acceptance test:**

- [ ] Full clean playthrough start→boss→results with zero console errors (PDR acceptance #16).
- [ ] Every enemy type gets an isolated introduction before appearing in combinations.
- [ ] At least two obvious recovery valleys; the difficulty table shows a rising sawtooth, not a ramp.

---

## Sprint 7.2 — Difficulty Modifiers

**Goal:** PDR §15 — same level, multiplied.

**Deliverables:**

1. `src/content/difficulty.json` per the PDR example (`normal`, `hard`) plus `easy` (0.85 / 0.85 / 1.2).
2. `src/game/systems/DifficultyManager.ts`: selected difficulty scales enemy health, projectile speed, and spawn/cooldown delays at the point of value consumption (never mutate loaded content). Multiplier hooks in: Enemy.activate (health), EnemyWeapon (speed, cooldown), FormationSpawner (delays).
3. Menu gains a 3-option difficulty selector (keyboard left/right).
4. Unit tests: modifier application on all three hook points.

**Acceptance test:**

- [ ] Hard is measurably harder (bullet speed visibly up, gaps tighter); easy is friendlier; content files unchanged on disk and in memory (spot-check the registry object is pristine after a hard run).

---

# EPOCH 8 — Authoring Tool (3 sprints)

Maps to PDR Phase 4 / §23. Kept deliberately minimal per PDR risk "editor becomes larger than the game."

---

## Sprint 8.1 — Editor Shell, Event List, Save/Load

**Deliverables:**

1. `npm i react react-dom`; Vite multi-page setup: `/index.html` (game) + `/editor.html` (editor) — two entry points, shared `src/`.
2. `src/editor/EditorApp.tsx`: three-region layout per PDR §23.3 (toolbar / main / timeline list). Dark, dense, functional — read `frontend-design` conventions if styling from scratch, but do not spend sprint time on aesthetics.
3. Level select (dropdown of registry levels) → chronological event list (time, type, encounter id) sorted by `at`.
4. Editing v1: change an event's `at` (numeric input), delete event, add encounter event (dropdown of existing encounter ids + time field). All edits operate on an in-memory copy.
5. Save: download the edited level as JSON (`file-saver` or anchor-blob). Load: file input importing a level JSON (validated with the same Zod schema; errors shown inline). LocalStorage autosave of the working copy every edit.

**Acceptance test:**

- [ ] Open `/editor.html`, load level_01, see all events in order; move the miniboss 10s later, export, drop the file into `src/content/levels/`, reload the game → change is live.
- [ ] Invalid imported JSON shows the Zod error, doesn't corrupt state; refresh restores autosaved work.

---

## Sprint 8.2 — Inspector & Validation Panel

**Deliverables:**

1. Inspector panel: selecting an event shows type-appropriate fields (encounter picker, x/y for spawn events, name for checkpoints); edits write to the working copy live.
2. Validation panel: runs the full ContentRegistry reference check against the working copy + all content; lists errors (missing encounter/enemy/formation/pattern ids) with the offending file/event; toolbar Validate button + auto-run on save.
3. Read-only encounter peek: clicking an encounter id shows its JSON (pretty-printed) and its metadata (difficulty, skills, duration) — no encounter editing this release (scope guard).
4. Intensity strip: a simple horizontal bar chart above the event list — one bar per encounter positioned by time, height = difficulty 1–5. (This is the cheap version of PDR §15.3's intensity curve.)

**Acceptance test:**

- [ ] Every editable field round-trips through export correctly.
- [ ] Renaming an encounter reference to a bogus id is caught by Validate with a precise message.
- [ ] Intensity strip visually matches the README difficulty table from S7.1.

---

## Sprint 8.3 — Embedded Preview & Play-From-Event

**Goal:** PDR acceptance #10: launch a preview from a selected event.

**Deliverables:**

1. Preview panel embeds the game via `<iframe src="/index.html?level=<id>&t=<seconds>&preview=1">`.
2. Game reads URL params: `level` selects the level, `t` uses the S4.4 seek machinery to start at that time, `preview=1` enables debug overlay + invulnerability default ON + skips menu.
3. Editor buttons: **Play from start**, **Play from selected event** (t = event.at − 2s), **Restart preview** (reload iframe). Working-copy sync: before launching, serialize the working copy into localStorage under a known key; in preview mode the game checks that key and overrides the registry's copy of that level.
4. Pause/step: reuse in-game debug (`[`,`]`, seek keys) — document them in an editor help tooltip rather than building duplicate transport controls (scope guard; PDR lists Pause/Step as editor features, and keyboard-in-iframe satisfies it for v1 — note this decision in README).

**Acceptance test:**

- [ ] Full loop: nudge an event time → Play from selected event → watch the change → adjust → replay, all without touching an IDE or rebuilding. **This is PDR §5.6 and the whole point of the project — test it honestly, three iterations minimum.**
- [ ] Preview always reflects unsaved working-copy edits.

---

# EPOCH 9 — Polish & Release (6 sprints)

Maps to PDR Phase 6.

---

## Sprint 9.1 — Audio

**Deliverables:**

1. `src/game/systems/AudioManager.ts`: category volumes (master/music/sfx), concurrency limits per sound key (e.g., player shot ≤3 simultaneous, cap replaces oldest), priority override for warning sounds, `visibilitychange` → mute/pause.
2. Audio unlock already gated by Menu interaction (S0.3) — wire actual `AudioContext` resume there.
3. Placeholder audio: generate simple sounds with a tiny WebAudio synth util (square-wave shot blip, noise-burst explosion, sine pickup chirp, saw warning) so no asset dependency; music = a looping generated arpeggio pad or silence with the hook in place. Encounter events `playSound`/`playMusicCue` implemented against it.
4. Boss music transition: `startBoss` triggers a music cue swap.

**Acceptance test:**

- [ ] No audio before first interaction; all categories mixable; 50 bullets don't produce 50 overlapping blips; backgrounding the tab silences the game; sounds resume on return.

---

## Sprint 9.2 — Gamepad & Touch

**Deliverables:**

1. Gamepad backend in InputManager per the PDR §8.1 table (left stick + d-pad move with deadzone 0.15, face buttons fire, start pauses); hot-plug detection; last-used-device wins (no mode switch UI).
2. Touch backend per PDR §4.2: drag-anywhere relative movement (ship follows finger delta ×sensitivity, not absolute position — finger never covers the ship), auto primary fire while touching, one bottom-corner button for secondary, pause icon top-corner. Multi-touch: movement pointer = first touch; buttons on their own touch ids.
3. `touchSensitivity` setting hook (slider lands in S9.3).
4. Mobile perf flag: if touch is the active device, halve particle counts and cap enemy bullets at 300 (config, not hardcode).

**Acceptance test:**

- [ ] Full level clearable on gamepad without touching the keyboard.
- [ ] On a phone (or devtools touch emulation): drag moves ship smoothly under a finger held anywhere; auto-fire works; secondary button and pause reachable by thumbs.

---

## Sprint 9.3 — Settings & Persistence

**Deliverables:**

1. `src/game/systems/SaveData.ts`: versioned localStorage blob (`skyforge_save_v1`) — settings (volumes, screenShake 0–1, flashIntensity 0–1, reducedParticles, touchSensitivity, keybinds), highScore, bestTime, highestMultiplier, tutorialSeen. Migration stub for future versions.
2. Settings scene per PDR §19.3 (keyboard-navigable list; sliders as left/right adjustable bars): all listed settings including keyboard remap (press-to-bind for move/fire/secondary/special/focus) and fullscreen toggle.
3. Screen shake + hit flash systems now route through their intensity settings; reducedParticles halves emitter quantities.
4. Results screen writes high score/best time; Menu displays them.

**Acceptance test:**

- [ ] Every setting takes effect immediately and survives a hard refresh; remapped keys work in-game; corrupted save JSON is detected and reset without crashing (PDR acceptance #13).

---

## Sprint 9.4 — Screen Flow & Pause

**Deliverables:**

1. Complete flow per PDR §19.2: Loading (real asset progress now) → Title → controls hint page → Level intro card ("Coastal Approach", 1.5s) → gameplay → Pause menu (Resume/Restart from checkpoint/Settings/Quit; `scene.pause` + overlay scene so tweens/audio halt correctly) → GameOver → Results → Title.
2. ESC/Start/pause-icon all route to pause; window `blur` auto-pauses.
3. Title screen polish pass: layered background, subtle motion, high score display.

**Acceptance test:**

- [ ] PDR acceptance #14: complete title-to-results flow with no dead ends; pause during boss + resume works; auto-pause on tab switch.

---

## Sprint 9.5 — Performance & Telemetry

**Deliverables:**

1. Stress harness: dev key spawns the worst-case scene (boss P3 + 2 formations + max bullets). Instrument with `performance.now()` frame timing; log p95 frame ms over 30s.
2. Optimization pass to hit PDR §4.3 (60fps, ≤16.7ms at target load): confirmed no per-frame allocations in hot paths (Projectile.preUpdate, MovementRunner, collision callbacks — audit with the Chrome allocation profiler); collision uses category masks so player-bullets never test enemy-bullets; text objects update at most 2Hz.
3. `src/game/debug/Telemetry.ts` per PDR §28: record deaths (levelTime, x, y), damage events, encounter completion times, weapon usage seconds, avg multiplier, fps drops (<50 sustained 1s), projectile peaks; export button on Results (dev builds) downloading JSON.
4. Document measured numbers (device, p95, peak projectiles) in README.

**Acceptance test:**

- [ ] Stress scene holds ≥60fps on the reference desktop (or documents exactly where it lands); ≥600 active projectiles sustained without stutter.
- [ ] A played run exports a telemetry JSON with plausible values.

---

## Sprint 9.6 — CI, Browser Tests & Deploy

**Deliverables:**

1. Playwright smoke tests per PDR §30.3: app loads, keypress reaches GameScene, player moves (screenshot-diff or position probe via an exposed `window.__skyforge` dev handle), pause opens, level JSON loads, zero console errors during a 30s scripted run.
2. GitHub Actions: lint + typecheck + vitest + playwright + build on push.
3. Static deploy (GitHub Pages / Netlify / Cloudflare Pages): correct base path config, both `/` and `/editor.html` served.
4. Cross-browser manual pass: Chrome, Edge, Firefox, Safari — log results in README.
5. Final acceptance sweep: walk PDR §31's 16 criteria, check each off with evidence links in README.

**Acceptance test:**

- [ ] Green CI; public URL playable end-to-end on all four browsers; editor reachable at the deployed `/editor.html`; PDR §31 table fully checked.

---

# EPOCH 9R — Release-Gate Remediation & Adaptive Music (complete)

**Implementation date:** 2026-07-12
**Detailed evidence:** `EPOCH_9R_IMPLEMENTATION.md`

Epoch 9R is a corrective gate rather than a feature-volume sprint. It resolves gamepad enablement, browser audio unlock, Pause → Settings run preservation, touch conflicts, persistence corruption, editor preview mutation, semantic level validation, Pages base paths, lifecycle cleanup, and missing telemetry wiring.

It also introduces the first production-shaped music foundation:

- validated music cue definitions;
- shared-clock synchronized stems;
- pure adaptive intensity model with hysteresis and dwell time;
- original FM/tracker demonstration cue;
- pause/resume and scene cleanup;
- music debug state and browser smoke hooks.

### Epoch 9R acceptance state

- [x] Typecheck, lint, 160 unit/content tests, production build, and base-path verification pass.
- [x] Gamepad Plugin enabled and menu navigation implemented.
- [x] Pause → Settings → Pause preserves the active run.
- [x] AudioContext is created only from a valid user gesture.
- [x] Touch buttons no longer become movement anchors; sensitivity is applied.
- [x] Save fields are sanitized independently.
- [x] Preview no longer mutates canonical content.
- [x] Invalid levels are blocked from standard export.
- [x] Adaptive stems start from one scheduled AudioContext time.
- [x] Music state is derived from runtime pressure and boss lifecycle.
- [x] Run/checkpoint state is explicit through a pure `RunSession` snapshot boundary.
- [ ] Physical iPhone and controller QA completed on target devices.
- [ ] Final hangar, boss, transition, victory, and economy cues produced.
- [ ] Full bar-aligned cue-to-cue transition scheduler implemented.

---

# EPOCH 10 — Ship Configuration, Credits, Equipment & Progression (complete)

**Implementation date:** 2026-07-12  
**Detailed evidence:** `EPOCH_10_IMPLEMENTATION.md`

Epoch 10 implements the hybrid upward-progression/side-grade model from `SHIP_CONFIGURATION_EQUIPMENT_ECONOMY_PROGRESSION.md`.

### Delivered

- [x] **10.1 — Player profile and currency ledger**  
      Save v2, v1 migration, persistent credits, bounded ledger, legal starter profile.
- [x] **10.2 — Equipment schemas and content registry**  
      21 items across hull, primary/secondary weapon, propulsion, generator, shield, armor, and utility categories.
- [x] **10.3 — Loadout validation and pure derived-stat calculation**  
      Ownership, unlock, hardpoint, size, mass, power, utility, deterministic statistics, and navigation envelopes.
- [x] **10.4 — Runtime ship integration**  
      Loadout-derived movement, energy, shield/armor defense, weapon energy, HUD, and immutable runtime snapshots.
- [x] **10.5 — Hangar inventory and transaction service**  
      Browse, compare, buy, sell/refund, equip, upgrade, validate, persist, and launch.
- [x] **10.6 — Mission rewards and results settlement**  
      Enemy/ground/boss/pickup rewards, checkpoint escrow, idempotent settlement, progression, and itemized results.
- [x] **10.7 — Economy/audio integration and balance harness**  
      Tonal pickup chains, transaction feedback, debug economy grant, deterministic reward/RNG replay, and expanded tests.

### Acceptance state

- [x] Title → Hangar → Mission → Results → Hangar flow implemented.
- [x] Equipment state remains outside `GameScene` through profile/economy/loadout services.
- [x] Failed transactions are atomic.
- [x] Checkpoint retry cannot duplicate rewards.
- [x] Mission settlement is idempotent.
- [x] 209 unit/content tests pass.
- [x] Typecheck, lint, production build, `/skyforge/` build, and dependency audit pass.
- [ ] Physical iPhone, controller, and full browser E2E QA completed externally.
- [ ] Final hangar art, equipment icons, and campaign-scale balancing completed.

Epoch 11 may now consume `collisionRadius`, `minimumCorridorWidth`, maximum speed, focused speed, acceleration, and drag from the calculated loadout when validating solid-terrain routes.

---

# EPOCH 11 — Solid Terrain Runtime & Level Composer Expansion (complete)

**Implementation date:** 2026-07-12  
**Detailed evidence:** `EPOCH_11_IMPLEMENTATION.md`  
**Governing design:** `TILE_ASSET_PIPELINE_AND_LEVEL_COMPOSER.md`

Epoch 11 establishes the first production-shaped terrain package, gameplay runtime, route/fairness analysis, and combined spatial/timeline Composer.

### Delivered

- [x] **11.0 — Composer foundation refactor**  
      Stable event IDs, normalized `EditorProject`, snapshot undo/redo, package autosave, Level Package v2 import/export.
- [x] **11.1 — Tile runtime and map viewport**  
      32px grid, 544px internal width, 17 columns, semantic layers, chunked rendering, pan-by-row, zoom, paint/erase/fill, layer visibility/lock/solo/order.
- [x] **11.2 — Collision and route authoring**  
      Independent corridor geometry, route centerline, largest-hull preview, clearance/reaction analysis, swept player/projectile collision, gate/barrier interaction.
- [x] **11.3 — Autotiling and biome foundation**  
      Biome/material manifests, cardinal variants, exposed-edge descriptors, first dual-grid boundary overlay, directional edge rendering.
- [x] **11.4 — Dynamic terrain and atmosphere**  
      Deterministic animated-material accents, weather layer, timeline-controlled gate, destructible reward-bearing barrier, checkpoint/seek state.
- [x] **11.5 — Timeline and analysis integration**  
      `terrainState` events, target validation, combined terrain/combat pressure warnings, preview overrides, terrain debug/E2E handle.
- [x] **11.6 — Canyon vertical slice**  
      River parallax, solid cliffs, generated edge treatment, dust overlay, timed gate, destructible barrier, combat, checkpoint-safe state.

### Acceptance state

- [x] 32px grid and documented 544px internal width.
- [x] Validated multi-file package with separate timeline, map, collision, routes, objects, and biome data.
- [x] Collision-aligned visuals enforce scroll ratio 1.0.
- [x] Chunks stream and recycle outside the active range.
- [x] Paint, erase, fill, undo, redo, layer visibility, lock, solo, and order controls.
- [x] Cardinal/dual-grid autotile foundation and canyon-generated boundary variants.
- [x] Independent authoritative collision editing.
- [x] Swept player and projectile collision.
- [x] Route clearance, navigation-hull, reaction-time, and combat-pressure analysis.
- [x] Timeline gate/destruction state reconstructs during seek and checkpoint retry.
- [x] Invalid/incomplete packages and impossible routes block export.
- [x] Canyon runtime integrates parallax, collision, animation accents, destruction, gates, combat, and adaptive music.
- [x] Terrain algorithms remain outside `GameScene`.
- [ ] Final texture-atlas art and authored animation frames replace procedural material rendering.
- [ ] Arbitrary polygon and edge-chain collision authoring is complete.
- [ ] Physical iPhone/controller and cross-browser QA is complete.

---

# EPOCH 12 — Game Design Studio Foundation (implemented)

**Governing design:** `GAME_DESIGN_STUDIO_ARCHITECTURE.md`  
**PDR review:** `EPOCH_12_PDR_REVIEW.md`

Epoch 12 establishes package boundaries and a shared authoring shell before deeper specialist tools are built.

### 12.1 — Four package schemas

- [x] `.sflevelpack`
- [x] `.sftuning`
- [x] `.sfmusic`
- [x] `.sfassetpack`
- [x] Manifest, resource, author, license, dependency, and semantic-version contracts
- [x] Data-only security boundary

### 12.2 — Workspace and package codec

- [x] `.sfworkspace` lock file
- [x] Local workspace persistence
- [x] Portable JSON import/export
- [x] Deterministic serialization and fingerprints
- [x] Custom-extension file handling

### 12.3 — Dependency resolver and compiler

- [x] Required and optional dependencies
- [x] Exact, minimum, and compatible-major version ranges
- [x] Missing package, mismatch, duplicate, and cycle reporting
- [x] Cross-package level/music and tuning/asset validation
- [x] Deterministic compiled-content manifest

### 12.4 — Game Design Studio shell

- [x] Level, tuning, music, asset, and build workspaces
- [x] Package status and compile report
- [x] Import and independent four-package export
- [x] Workspace export
- [x] Responsive authoring shell

### 12.5 — Level Studio bridge

- [x] Existing Epoch 11 Composer embedded without regression
- [x] Unsaved working project captured as `.sflevelpack`
- [x] Loaded Level Pack pushed into the Level Studio
- [x] Existing Level Package v2 validation retained

### 12.6 — Shared runtime bridge

- [x] Same Phaser runtime embedded in the Studio
- [x] Start, restart, pause, resume, seek, and invulnerability controls
- [x] Level, time, scene, pause, and music-state reporting
- [x] Foundation for later live tuning and deterministic snapshot transport

### 12.7 — Specialist workspace foundations

- [x] Tuning: enemy and difficulty editing with `.sftuning` export
- [x] Music: cue playback, BPM/source metadata, instrument library, `.sfmusic` export
- [x] Assets: semantic browser, altitude/shadow preview and metadata, `.sfassetpack` export
- [x] Build: dependency graph, compile issues, workspace lock, deterministic build summary

### Epoch 12 release gate

- [x] Typecheck, lint, 242 unit/content tests, production build, and base-path build pass.
- [x] Studio, Level Studio, and game entry points are present in the packaged build.
- [x] Four exported packages round-trip through validation.
- [x] Missing dependencies block compilation.
- [x] Clean archive installation and rebuild pass.
- [x] Seven browser scenarios are configured for local/CI; sandbox localhost blocking is documented.

---

# EPOCH 13 — Simulation, Live Tuning & Timeline Transport ✅ COMPLETE

Epoch 13 turns the Epoch 12 shared-runtime shell into an authoring laboratory. All tuning remains package data, and simulation runs inside the same Phaser runtime used by the game.

## 13.1 — Schema-generated live tuning

- [x] Generate numeric controls for enemies, difficulty, projectiles, movement, weapons, bosses, and encounters.
- [x] Preserve units, min/max bounds, and safe step sizes.
- [x] Apply validated `.sftuning` overlays only inside the embedded Studio runtime.
- [x] Restore the built-in registry without reloading the page.
- [x] Export scalar review diffs as Markdown.

## 13.2 — Isolated simulation arenas

- [x] Full level
- [x] Single enemy
- [x] Player weapon
- [x] Formation
- [x] Encounter
- [x] Boss
- [x] Terrain route
- [x] Active loadout
- [x] Repeat, reset delay, and auto-fire controls

## 13.3 — Video-style timeline transport

- [x] Play, pause, restart, forward step, reverse step, and 0.25×–4× speed.
- [x] Scrub bar with current time and authored duration.
- [x] Loop-in and loop-out region.
- [x] Attention marker jumps.
- [x] Configurable 2, 5, or 10 second snapshot interval.

## 13.4 — Snapshot-assisted seeking

- [x] Periodic bounded snapshot ring.
- [x] Restore player position, armor, shields, energy, score, and multiplier tier.
- [x] Restore terrain state, live enemies, enemy weapon timing, projectiles, missiles, and pickups.
- [x] Restore active boss identity and replay the short remainder from the nearest anchor.
- [x] Preserve authored event firing state through `LevelTimeline.seekTo`.
- [x] Send lightweight snapshot indexes to the Studio instead of full runtime state.

Snapshot transport is an authoring convenience, not a deterministic replay certification system. Boss phase internals, particle state, sound transients, and physics-contact caches may reconstruct approximately.

## 13.5 — Attention analysis

- [x] Derive normalized intensity bins from level and tuning package content.
- [x] Mark encounters, checkpoints, bosses, terrain events, recovery periods, peaks, and warnings.
- [x] Overlay markers on the transport and expose one-click jumps.

## 13.6 — Telemetry and A/B comparison

- [x] Sample enemy count, player/enemy projectiles, survivability, multiplier, frame time, and intensity.
- [x] Render a live intensity heatmap.
- [x] Capture A and B telemetry sets.
- [x] Compare mean enemies, peak bullets, intensity, survivability, and p95 frame time.
- [x] Bound internal telemetry memory and limit cross-frame message payloads.

## Epoch 13 release gate

- [x] Typecheck, lint, unit/content suite, root build, and `/skyforge/` base build pass.
- [x] Live tuning remains transient and does not mutate canonical package files until the author saves.
- [x] All eight arena types validate and reset cleanly.
- [x] Snapshot interval can be changed while authoring.
- [x] Legacy snapshot payloads migrate through schema defaults.
- [x] Browser scenarios cover Studio runtime startup, arena selection, snapshots, telemetry, and transport for local/CI execution.

---

# EPOCH 14 — Asset Studio Production Workflow ✅ COMPLETE

## 14.1 — Verified resource ingestion

- [x] PNG/WebP import with filename, dimensions, byte count, and SHA-256.
- [x] Author, licence, source, tool, timestamp, and notes provenance.
- [x] Embedded portable resources for collaborator package exchange.
- [x] IndexedDB persistence for image-bearing working packs.
- [x] Unsafe URI, malformed resource, hash, and byte-count validation.

## 14.2 — Sprite and presentation authoring

- [x] Semantic asset roles and candidate/approved/rejected curation.
- [x] Uniform sprite-sheet slicing and named animation definitions.
- [x] Pivot, scale, circle/rectangle/polygon collision preview, and hardpoints.
- [x] Altitude and separate shadow asset/offset/scale/opacity/softness metadata.
- [x] Neutral, canyon, ice, space, station, and combat preview contexts.

## 14.3 — Tilesets and autotile metadata

- [x] Promote image assets into tilesets.
- [x] Tile size, margin, spacing, rows, columns, semantic tile definitions, and animation references.
- [x] Cardinal, dual-grid, and Wang-mode metadata.
- [x] Sixteen cardinal mask mappings for deterministic Level Studio consumption.

## 14.4 — Deterministic atlas workflow

- [x] Stable sorted shelf packing and deterministic frame keys.
- [x] Atlas image generation, embedded resource hashing, and frame metadata.
- [x] Automated non-overlap and repeatability tests.

## 14.5 — Runtime and package integration

- [x] Shared Phaser runtime preview of the active Asset Pack.
- [x] Animation, shadow, collision, pivot, and hardpoint display.
- [x] Asset-reference health report against the active Tuning Pack.
- [x] Immutable asset-reference replacement proposal.
- [x] `.sfassetpack` export and semantic validation.
- [x] Built-in verified fighter, shadow, and canyon-tileset demonstration resources.

## Epoch 14 release gate

- [x] Typecheck, lint, unit/content suite, root build, and `/skyforge/` base build pass.
- [x] Existing Epoch 9R–13 systems remain compatible.
- [x] Checked-in demo resources match declared hashes and byte counts.
- [x] Browser scenario covers Asset Studio workspace, previews, subtools, and runtime bridge for local/CI execution.

---

# EPOCH 15 — Tracker/FM Music Studio ✅ COMPLETE

## 15.1 — Tracker source and arrangement

- [x] Pattern grid with note, instrument, velocity, duration, and effect cells.
- [x] Pattern order, loop range, BPM, rows-per-beat, swing, and master gain.
- [x] Stable channel, pattern, instrument, and composition IDs.
- [x] Grid quantization and deterministic event scheduling.

## 15.2 — FM and sample instruments

- [x] FM waveform, operator ratios, modulation index, feedback, detune, vibrato, ADSR, gain, and pan.
- [x] On-screen chromatic audition keyboard and note entry.
- [x] Sample-instrument metadata and WAV/OGG/MP3/M4A import.
- [x] Imported audio byte-count, SHA-256, provenance, licence, and embedded-resource verification.

## 15.3 — Adaptive authoring

- [x] Channel-to-stem routing, gain, pan, mute, and solo.
- [x] Recovery, normal, combat, critical, and boss mix preview.
- [x] Per-state stem-gain editing.
- [x] Boss, victory, and defeat cue-transition targets.

## 15.4 — Runtime synchronization

- [x] Shared game-runtime Music Pack overlay.
- [x] Cue preview from explicit adaptive state and offset.
- [x] Composition playhead synchronization with the level timeline.
- [x] Baseline restoration without canonical-content mutation.

## 15.5 — Rendering and loop analysis

- [x] Pure deterministic FM tracker renderer.
- [x] Synchronized stereo stem and full-mix output.
- [x] PCM WAV encoding and download.
- [x] Loop-boundary discontinuity measurement.
- [x] Rendered stem embedding into portable `.sfmusic` packages.

## 15.6 — Package, storage, and validation

- [x] IndexedDB persistence for audio-bearing working Music Packs.
- [x] Semantic validation for composition, cue, transition, pattern, channel, instrument, and resource references.
- [x] Data-only import and safe URI enforcement.
- [x] Updated checked-in collaboration example and built-in tracker source.

## Epoch 15 release gate

- [x] Typecheck, lint, unit/content suite, root build, and `/skyforge/` base build pass.
- [x] Existing Epoch 9R–14 systems remain compatible.
- [x] Resource-integrity tests cover embedded audio byte counts and SHA-256.
- [x] Post-epoch architecture, security, performance, and UX audit completed.
- [x] Browser scenario covers tracker, instruments, adaptive controls, rendering, and runtime preview for local/CI execution.

Epoch 16 now supplies migrations, locks, folder transport, generated-resource hashing, release compilation, build budgets, contributor workflows, and browser-device automation. Sample decoding, Music-specific undo/redo, render workers, automatic loop crossfades, and physical-device execution remain later refinements.

---

# EPOCH 16 — Collaboration & Production Compiler — COMPLETE

1. [x] Unpacked Git folder mode with stable per-item files, order indexes, and binary resources.
2. [x] Package/workspace schema-v1 → v2 migrations and exact dependency lock files.
3. [x] Deterministic change reports plus persistent note/suggestion/blocking review comments.
4. [x] Production compiler with resource loading, byte/hash verification, content-addressed copy, atlas-manifest preservation, and dead-resource removal.
5. [x] Contributor onboarding, pull-request/issue templates, portable examples, and Git-folder examples.
6. [x] Manual chunking, enforceable build budgets, desktop Chromium plus mobile Chromium/WebKit automation, and physical-device QA matrix.
7. [x] Campaign-scale package assembly, checked dependency lock, release manifest, and CI validation.

**Release result:** Epoch 16 completes the planned Game Design Studio foundation. Further work should prioritize production content, campaign expansion, physical-device QA, accessibility, and workflow refinement rather than another foundational package rewrite.

---

# Stretch Backlog (post-slice, unordered)

- `orbit_point` + `follow_leader` movement (deferred from S3.5)
- Drag-and-drop timeline, Bézier path editor, formation preview (PDR §23.5)
- Moving/destructible solid terrain beyond the first gate/hazard implementation
- High-contrast projectile mode + color-blind palettes (PDR §20)
- Real art/audio asset integration pass (atlases via TexturePacker, music)
- Tiled integration for `groundObjects` authoring (PDR recommends Tiled; S4.5's JSON list is the v1)
- Special weapon / bomb (input slot already exists in InputManager)
- Seeded daily run, second level, campaign shell (PDR §34)

---

# Dependency Map (what blocks what)

```
0.1 → 0.2 → 0.3 → 1.1 → 1.2 → 1.3 → 1.4
                              1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5
2.5 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5
3.5 → 4.1 → 4.2 → 4.3 → 4.4 → 4.5
4.4 → 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6
5.6 → 6.1 → 6.2 → 6.3
6.3 → 7.1 → 7.2
4.4 + 7.1 → 8.1 → 8.2 → 8.3
7.2 → 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6
```

Epochs 8 and 9.1–9.3 can be parallelized after 7.1 if two sessions run concurrently, but sequential execution is safer for a single-model workflow.

---

# Sprint Count Summary

| Epoch             | Sprints                                    | Theme                                           |
| ----------------- | ------------------------------------------ | ----------------------------------------------- |
| 0                 | 3                                          | Foundation                                      |
| 1                 | 4                                          | Player core                                     |
| 2                 | 5                                          | First combat loop                               |
| 3                 | 5                                          | Data-driven definitions                         |
| 4                 | 5                                          | Formations / encounters / timeline              |
| 5                 | 6                                          | Content systems                                 |
| 6                 | 3                                          | Bosses                                          |
| 7                 | 2                                          | Level assembly + difficulty                     |
| 8                 | 3                                          | Editor                                          |
| 9                 | 6                                          | Polish + release                                |
| 9R                | 1 gate                                     | Release remediation + adaptive music foundation |
| 10                | 7                                          | Economy, equipment, loadout, progression        |
| 11                | 7 milestone groups                         | Solid terrain runtime + Level Composer          |
| 12                | 7 groups                                   | Game Design Studio foundation                   |
| 13                | 8                                          | Simulation, tuning, and timeline                |
| 14                | 7                                          | Asset Studio                                    |
| 15                | 7                                          | Music Studio                                    |
| 16                | 7                                          | Collaboration and production compiler           |
| **Total planned** | **88 sprints/groups + 1 remediation gate** |                                                 |

Each sprint is sized for one focused model session (roughly 200–800 lines of change) and ends with something you can see, play, and verify in the browser immediately.

---

# Revision 1.1 — Level Composer Integration & Triple Parallax

**Reference:** `level_editor_asset_generation_addendum.md` (Level Composer / Asset Studio / Intelligent Map Generator).

## Decisions

1. **The addendum's central rule is already our architecture.** Level geometry, encounter choreography, and asset production stay separate data domains. Nothing in Epochs 3–9 changes; the Level Composer bolts on after the economy/loadout work as **Epoch 11**, replacing the "Tiled integration" stretch item.

2. **Forward-compatibility hooks (small, land inside existing sprints):**
   - **S1.4 (amended, done):** parallax is now a config-driven layer list (three layers: far/mid/near). When the Composer's chunked tile maps arrive, they render _between_ far parallax and the near overlay — same `ScrollController`/depth discipline, no rewrite.
   - **S4.4 (amended):** `levelSchema` gains `formatVersion: "1.0"` (addendum §23) and an optional `scrollProfile: [{startTime,endTime,speed}]` (addendum §4). The runtime supports segmented speed from day one; v1 content may simply omit it (constant speed).
   - **S4.5 (unchanged, emphasized):** ground objects carry stable string `id`s so `encounters.json` can reference them across map regeneration (addendum §19).
   - **S8.x (unchanged):** the minimal timeline editor remains the v1 authoring tool. It edits _choreography_; the Composer edits _geometry_. They are different apps sharing `src/schemas/`.

3. **Epoch 11 — Terrain-first Level Composer:**
   - The solid-terrain addendum is now the controlling foundation for geometry work.
   - Runtime collision, chunking, route validation, checkpoint/seek state, and a terrain vertical slice land before procedural generation.
   - The package expands to `level.json` + `map.json` + `collision.json` + `routes.json` + `encounters.json` + `manifest.json`.
   - The Composer must edit collision independently from visuals and block export when no valid player route exists.
   - The seeded generator must generate a route spine and clearance envelope before selecting terrain tiles.
   - Asset Studio, geospatial import, and AI assistance remain later and licensing-gated.

## Sprint 3.x note

Epoch 3's Zod schemas are the shared foundation both editors consume — schema quality here is a Composer prerequisite, not just a game concern.

---

# Revision 1.2 — Solid Terrain Navigation

**Reference:** `SOLID_TERRAIN_NAVIGATION_AND_LEVEL_COMPOSER.md`

1. Solid walls, canyon edges, gates, and obstacles become first-class gameplay geometry.
2. Epoch 10 adds only ship navigation-envelope contracts; the full runtime remains Epoch 11.
3. Epoch 11 is reordered terrain-first so map generation and asset production cannot proceed without collision and route validity.
4. The campaign default uses damage plus separation and invulnerability; lethal wall contact is reserved for explicit challenge rules pending playtesting.
5. The editor must validate minimum clearance, reaction time, checkpoint placement, and combined terrain/combat pressure.

# EPOCH 17 — AI Asset Foundry — COMPLETE

1. [x] Structured asset briefs with semantic role, dimensions, view, palette, lighting, animation-state and hardpoint requirements.
2. [x] Versioned prompt compiler with category templates, technical constraints, revision instructions and originality requirements.
3. [x] Secure loopback Node gateway with environment-only OpenAI credentials, origin allow-list, body limits, timeouts and fixed image endpoints.
4. [x] Equivalent manual ChatGPT-import workflow using the same generation-job lineage.
5. [x] Candidate gallery records, parent revisions, master selection, rejection and status progression.
6. [x] Non-destructive pixel-processing derivatives with matte removal, crop, alpha threshold, resizing and palette reduction.
7. [x] Runtime test reports, approval gates, mobile/collision/hardpoint/shadow warnings and approval metadata.
8. [x] Transactional enemy/equipment visual assignment with stale-proposal protection.
9. [x] Asset Pack and Git-folder persistence for briefs, jobs, candidates, recipes, tests and assignments.
10. [x] Semantic validation, production dead-resource elimination, build budgets, unit coverage, documentation and post-epoch audit.

**Release result:** Epoch 17 makes model-generated artwork a governed Asset Studio input rather than an uncontrolled file import. The next production priority is an eight-asset Canyon vertical slice, followed by frame-consistency, palette, shadow, and batch-workflow refinements driven by real asset production.

# EPOCH 17.2 — SECURITY AND RELIABILITY REMEDIATION — COMPLETE

1. [x] Eliminate package-folder path traversal with schema-first parsing and resolved-path containment.
2. [x] Apply canonical safe authored IDs throughout package/content references.
3. [x] Protect non-empty unpack targets behind explicit `--force` and validate before deletion.
4. [x] Harden Foundry generation with Origin, Host, session-token, rate, and concurrency controls.
5. [x] Verify current provider request shape offline and add an opt-in paid live smoke test.
6. [x] Remove production query-param exposure of mutable debug controls and add a Studio nonce bridge.
7. [x] Add negative security tests and initial React component coverage for user-facing workflows.
8. [x] Correct shield timing, repeat-purchase behavior, 30/60/120 Hz tests, documentation drift, and archive hygiene.

**Residual engineering-health item:** decompose the large `GameScene` orchestration class and add direct scene/controller tests before adding another major runtime subsystem.


# EPOCH 17.3 — LEVEL STUDIO UX REDESIGN — COMPLETE

1. [x] Reorganize the Level Studio around a dominant map canvas and collapsible docks.
2. [x] Add a safe default Select tool and direct hit-tested object manipulation.
3. [x] Coalesce pointer strokes and object drags into single undoable transactions.
4. [x] Replace slider-only navigation with wheel pan, Space-drag, modifier zoom, minimap and fit/jump commands.
5. [x] Add a searchable visual material browser, recent palette and tile sampling.
6. [x] Add contextual selection/layer/analysis inspectors and mode-sensitive overlays.
7. [x] Add a lane-based draggable event timeline with playhead and timeline zoom.
8. [x] Reduce embedded-editor chrome and allow the shared runtime dock to be hidden for canvas-focused work.
9. [x] Add unit/component coverage for direct hit-testing, minimap mapping and one-stroke/one-commit behavior.

**Next usability track:** richer selection regions, copy/paste, stamps/prefabs, line/rectangle tools, comment pins, validation quick-fixes and live play-from-selection hot reload.


# EPOCH 17.4 — DEFAULT IMAGE-BACKED CANYON TILESET — COMPLETE

1. [x] Retain the generated canyon master as authoring source and add a reproducible normalization script.
2. [x] Build strict 32×32 terrain and props atlases with zero runtime gutters or margins.
3. [x] Add validated biome visual mappings and deterministic shared frame resolution.
4. [x] Render atlas-backed terrain in both the Level Studio and Phaser chunk runtime.
5. [x] Add material thumbnails, animated water preview and a visible metal-platform demonstration.
6. [x] Register matching resources and tileset metadata in the built-in Asset Pack and collaboration examples.
7. [x] Add PNG/hash, schema, resolver, component and browser-smoke validation.

**Next autotiling track:** strict gated Blob-47, true dual-grid half-tile overlays, local dirty-region regeneration, props/stamps and Asset Studio rule-set stress previews.

# EPOCH 17.5 — RUNTIME DECOMPOSITION AND QA AUDIT — COMPLETE

- Reduced `GameScene` from 1,682 lines to a 635-line composition root.
- Extracted combat, boss, mission flow, run progression, presentation, Studio simulation and diagnostics ownership.
- Corrected boss collider/object lifecycle, debug callback accumulation and stale asset-preview loading.
- Removed the package codec/validation import cycle and added an acyclic-graph gate.
- Completed a QA audit, deficiency report and optimization roadmap.
