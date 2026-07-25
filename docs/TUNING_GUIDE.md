# Skyforge Tuning Guide — How to Configure Gameplay

Everything about _how the game plays_ lives in JSON files under `src/content/`.
You never touch TypeScript to change enemy speed, fire patterns, formations,
encounter timing, or level pacing. Edit a `.json`, reload the browser, and the
change is live. If a file is malformed or references something that doesn't
exist, the game shows a **red error panel** naming the file and field instead of
crashing.

The golden rule of the architecture: **three separate worlds.**

| World                         | Folder                                              | Answers the question               |
| ----------------------------- | --------------------------------------------------- | ---------------------------------- |
| **What enemies are**          | `enemies/`, `weapons/`, `projectiles/`, `movement/` | How does one thing behave?         |
| **What happens over time**    | `formations/`, `encounters/`, `levels/`             | Who shows up, when, in what shape? |
| **What the world looks like** | (Level Composer, Epoch 11)                          | Terrain, buildings, background     |

You tune combat by editing the first world, and pacing by editing the second.

---

## 1. Units and conventions (read this first)

- **Time is in seconds** everywhere. `cooldown: 1.6` means 1.6 seconds.
- **Distances/speeds are in pixels.** The play area is **540 wide × 960 tall**.
  A `speed` of 130 means 130 pixels per second. As a feel reference: at 130 px/s
  an enemy crosses the whole screen top-to-bottom in about 7.4 seconds.
- **Angles are in degrees.**
  - Enemy fire, `aimed: false`: **0° = straight down** (toward the player's side).
    Positive angles fan one way, negative the other.
  - Enemy fire, `aimed: true`: **0° = straight at the player**, angles are offsets
    from that aim line.
  - Player weapons: **0° = straight up.**
  - Movement `angleDeg`: **0° = right, 90° = down** (standard screen math).
- **Every file's `id` must match its filename.** `light_fighter.json` must contain
  `"id": "light_fighter"`. The loader enforces this.
- **IDs are how the worlds connect.** An enemy names a `movementPattern` by id; a
  formation names `enemy` ids; an encounter names `formation` ids; a level names
  `encounter` ids. Change a number, not a wiring, and nothing else needs updating.

---

## 2. Tuning a single enemy — `enemies/*.json`

```json
{
  "id": "light_fighter",
  "displayName": "Light Fighter",
  "sprite": "tex_enemy_light",
  "health": 20,
  "collisionDamage": 1,
  "scoreValue": 100,
  "movementPattern": "sine_descent",
  "weaponPattern": "single_aimed_shot",
  "speed": 130,
  "hitbox": { "type": "circle", "radius": 14 },
  "drops": []
}
```

| Field             | What it does                                                                                         | Try changing it to…                            |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `health`          | Hit points. Pulse L1 does 10/shot.                                                                   | `5` = dies in one hit; `100` = a bullet sponge |
| `collisionDamage` | Hull damage if it touches your ship                                                                  | usually `1`                                    |
| `scoreValue`      | Points on kill                                                                                       | higher for tougher/priority targets            |
| `movementPattern` | **id** of a file in `movement/`                                                                      | see §3                                         |
| `weaponPattern`   | **id** of a file in `projectiles/`, or `null` for unarmed                                            | see §4                                         |
| `speed`           | Fallback descent speed (most patterns define their own speed; this is used by patterns that read it) | —                                              |
| `hitbox.radius`   | How big a target it is to _your_ bullets. Independent of sprite size.                                | smaller = harder to hit                        |
| `drops`           | Loot table, e.g. `[{ "pickup": "weapon_upgrade", "chance": 0.5 }]` (pickups activate in Sprint 5.2)  | `chance` is 0–1                                |

> **The PDR's design rule:** make enemies harder through _combinations and
> placement_, not by cranking `health`. A wall of 20-hp fighters that you must
> weave through is more interesting than one 400-hp fighter.

---

## 3. Movement patterns — `movement/*.json`

Movement is the single biggest lever on how an enemy _feels_. Each pattern is a
`type` plus parameters. Here are all eight, with the knobs that matter.

**straight** — a constant-direction line.

```json
{ "id": "straight_descent", "type": "straight", "angleDeg": 90, "speed": 130 }
```

`angleDeg` 90 = down. `speed` in px/s. Change `angleDeg` to 60 for a diagonal drift.

**sine** — descends while weaving side to side. The classic scout.

```json
{
  "id": "sine_descent",
  "type": "sine",
  "verticalSpeed": 110,
  "horizontalAmplitude": 80,
  "frequency": 1.4,
  "duration": 8
}
```

- `verticalSpeed` — how fast it comes down.
- `horizontalAmplitude` — how wide the weave (80 = ±80px).
- `frequency` — weaves per second. Higher = twitchier, harder to predict.
- `duration` (optional) — despawn after this many seconds.

**sweep** — enters from one side and crosses.

```json
{ "id": "sweep_left", "type": "sweep", "fromSide": "left", "angleDeg": 20, "speed": 220 }
```

`angleDeg` is travel direction (20 = mostly right, slightly down). Use with a
formation whose spawn `x` is off-screen (see §5).

**patrol** — drops to a height, then paces left/right. Good area-denial.

```json
{
  "id": "patrol_mid",
  "type": "patrol",
  "y": 200,
  "horizontalSpeed": 120,
  "leftX": 80,
  "rightX": 460,
  "entrySpeed": 160
}
```

`y` is the patrol altitude; `leftX`/`rightX` the bounds; `entrySpeed` how fast it
descends before pacing.

**bezier** — follows a smooth curve defined by 4 control points (relative to spawn).

```json
{
  "id": "bezier_s_curve",
  "type": "bezier",
  "points": [
    [0, 0],
    [-220, 320],
    [220, 640],
    [0, 1100]
  ],
  "duration": 7
}
```

First point is always `[0,0]` (spawn). Last is where it ends up. The two middle
points bend the path. `duration` is how long the whole curve takes.

**dive_retreat** — swoops toward where you _were_, pauses, then flees upward.

```json
{
  "id": "dive_retreat_fast",
  "type": "dive_retreat",
  "diveTargetYOffset": 620,
  "diveSpeed": 300,
  "pauseDuration": 0.6,
  "retreatSpeed": 240
}
```

It captures your X at the moment the dive starts (it commits — it doesn't home).
`diveTargetYOffset` is how far down it commits to.

**stop_and_fire** — enters, parks at a height, fires faster while parked, leaves.
The bomber/heavy behavior.

```json
{
  "id": "stop_and_fire_mid",
  "type": "stop_and_fire",
  "entrySpeed": 120,
  "stopY": 180,
  "holdDuration": 6,
  "exitAngleDeg": -90,
  "exitSpeed": 160,
  "holdFireRateMultiplier": 0.5
}
```

- `stopY` — where it parks.
- `holdDuration` — seconds parked (the danger window).
- `holdFireRateMultiplier` — `0.5` means cooldown is halved while parked (fires
  twice as fast). `exitAngleDeg` -90 = leaves straight up.

**enter_attack_exit** — the interceptor. Darts in from a side to a point, holds,
then exits along an angle.

```json
{
  "id": "enter_attack_exit_left",
  "type": "enter_attack_exit",
  "enter": { "fromSide": "left", "targetX": 180, "targetY": 240, "speed": 260 },
  "holdDuration": 1.6,
  "exit": { "angleDeg": 20, "speed": 300 }
}
```

> To make any enemy faster/slower, edit the `speed`/`verticalSpeed`/`entrySpeed`
> in **its movement file**. To make it move _differently_, point its
> `movementPattern` at a different file — or copy a movement file, tweak it, and
> give it a new id.

---

## 4. Fire patterns — `projectiles/*.json`

```json
{
  "id": "three_way_aimed",
  "projectileTexture": "tex_bullet_enemy",
  "count": 3,
  "angles": [-15, 0, 15],
  "aimed": true,
  "speed": 200,
  "cooldown": 1.6,
  "firstShotDelay": 0.8,
  "damage": 1,
  "lifetime": 6
}
```

| Field            | What it does                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `count`          | Bullets per volley. **Must equal `angles.length`** (the loader checks).                                          |
| `angles`         | One entry per bullet. `aimed:true` → offsets from the you-ward line. `aimed:false` → offsets from straight-down. |
| `aimed`          | `true` = tracks you at the moment of firing. `false` = fixed directions (e.g. a fan or a ring).                  |
| `speed`          | Bullet px/s. **This is your #1 difficulty dial** — fast bullets are much harder to dodge than many slow ones.    |
| `cooldown`       | Seconds between volleys. Lower = more pressure.                                                                  |
| `firstShotDelay` | Grace period after spawning before it can fire. Keeps entrances fair.                                            |
| `damage`         | Hull damage per hit (your hull is 3).                                                                            |
| `lifetime`       | Seconds before the bullet self-expires.                                                                          |

Examples in the repo: `single_aimed_shot` (one tracking shot), `three_way_aimed`
(a tracking fan), `five_way_spread` (a fixed 5-way fan, `aimed:false`).

**To make a "bullet hell" ring:** `aimed:false`, `count:12`,
`angles:[0,30,60,...,330]`, modest `speed`. **To make a sniper:** `count:1`,
`aimed:true`, high `speed`, short `cooldown`.

---

## 5. Formations — `formations/*.json`

A formation is a _shape_ of enemies that spawn together. It says nothing about
_when_ — that's the encounter's job (§6).

```json
{
  "id": "v_scouts",
  "movement": "sine_descent",
  "members": [
    { "enemy": "light_fighter", "offsetX": 0, "offsetY": 0, "delay": 0 },
    { "enemy": "light_fighter", "offsetX": -40, "offsetY": -30, "delay": 0.15 },
    { "enemy": "light_fighter", "offsetX": 40, "offsetY": -30, "delay": 0.15 }
  ]
}
```

- `movement` — the **default** pattern all members use.
- Each member:
  - `enemy` — which enemy id to spawn.
  - `offsetX` / `offsetY` — position **relative to the formation's spawn point**.
    Negative Y is above. This is how you draw the shape (a V, a row, a column).
  - `delay` — seconds after the formation starts before this member appears.
    Staggering delays makes formations "stream in" instead of popping in at once.
  - `movementOverride` (optional) — give one member a different movement (e.g. an
    escort where the leader parks and the guards weave).
  - `fireDelay` (optional) — extra delay before this member's first shot, so a
    sweeping line doesn't fire in one synchronized wall.

**Where does the formation spawn?** The encounter that calls it provides the
origin `x`/`y`. For patterns that enter from off-screen (`sweep`, some
`enter_attack_exit`), set that `x` to a negative number or one past 540.

**Two completion concepts** the systems track for you:

- _cleared_ = every member destroyed by the player (used for rewards).
- _done_ = every member destroyed **or** flown off-screen (used for gating).

---

## 6. Encounters — `encounters/*.json`

An encounter is a **reusable, self-contained fight**: a little timeline of events
plus a rule for when it's finished.

```json
{
  "id": "crossfire_intro",
  "estimatedDuration": 14,
  "difficulty": 2,
  "skillsTested": ["lateral_movement"],
  "events": [
    { "at": 0, "type": "spawnFormation", "formation": "left_sweep", "x": -40, "y": 160 },
    {
      "at": 1.5,
      "type": "spawnFormation",
      "formation": "right_sweep",
      "x": 580,
      "y": 240
    },
    { "at": 5, "type": "spawnFormation", "formation": "pinch_attack", "x": -40, "y": 120 }
  ],
  "completion": { "type": "allClear" }
}
```

**Events** (each has an `at` time in seconds, relative to the encounter start):

| `type`           | What it does                                                                |
| ---------------- | --------------------------------------------------------------------------- |
| `spawnFormation` | Spawn a formation at `x`,`y`                                                |
| `spawnEnemy`     | Spawn one enemy (`enemy`, `x`, `y`, optional `movementOverride`)            |
| `wait_for_clear` | Pause later events until everything spawned so far is gone — build "arenas" |
| `setScrollSpeed` | Change background/world speed (`multiplier`)                                |
| `setFlag`        | Set a named flag other events/encounters can check                          |
| `spawnPickup`    | Drop a pickup (wired up in Sprint 5.2)                                      |

**Completion** — how the encounter ends:

- `{ "type": "duration" }` — ends after `estimatedDuration` seconds no matter what.
- `{ "type": "allClear" }` — ends when every event has fired and every enemy is gone.
- `{ "type": "flag", "flag": "x" }` — ends when that flag is set.

**Metadata** (`difficulty` 1–5, `skillsTested`, `estimatedDuration`) isn't just
documentation — the level editor (Epoch 8) will graph it to visualize the
difficulty curve, so fill it in honestly.

Encounters can **overlap** — if a level starts two encounters close together,
they run independently at the same time.

---

## 7. Levels — `levels/*.json`

A level is the top-level schedule: which encounters play when, plus pacing beats
and the world scroll.

```json
{
  "formatVersion": "1.0",
  "id": "level_dev",
  "displayName": "Dev Corridor",
  "music": "none",
  "durationTarget": 60,
  "baseScrollSpeed": 100,
  "events": [
    { "at": 2, "encounter": "opening_scouts" },
    { "at": 18, "type": "checkpoint", "name": "pre_crossfire" },
    { "at": 20, "encounter": "crossfire_intro" },
    { "at": 36, "type": "recovery", "duration": 6 }
  ],
  "groundObjects": [{ "type": "turret", "id": "turret_01", "worldY": 1000, "x": 120 }]
}
```

- `baseScrollSpeed` — px/s the world scrolls (governs ground-object timing).
- **Optional `scrollProfile`** — for variable speed, replace the flat base with
  segments (this is forward-compat for the Level Composer):
  ```json
  "scrollProfile": [
    { "startTime": 0,   "endTime": 20,  "speed": 70 },
    { "startTime": 20,  "endTime": 170, "speed": 100 },
    { "startTime": 170, "endTime": 200, "speed": 40 }
  ]
  ```
- **events:**
  - `{ "at": t, "encounter": "id" }` — start an encounter at level-time `t`.
  - `{ "at": t, "type": "recovery", "duration": d }` — a calm beat: scroll eases
    and, because spawns only come from encounters, leaving a gap here _is_ the
    breather.
  - `{ "at": t, "type": "checkpoint", "name": "..." }` — a retry point. On death
    you can resume here with your weapon level preserved.
- **groundObjects** — turrets fixed to the scrolling terrain. `worldY` is the
  scroll distance (in px) at which it crosses the top of the screen; so with
  `baseScrollSpeed: 100`, `worldY: 1000` means it appears at about level-time 10s.
  `id` must be unique — encounters will reference these ids (Epoch 5+).

**Pacing shape the PDR asks for:** alternate low → moderate → high → recovery →
reward → climax. Don't run max intensity continuously. Use `recovery` beats and
watch that you don't test the same `skillsTested` in two back-to-back encounters.

---

## 8. Solid terrain tuning (Epoch 11)

Solid terrain is gameplay geometry, not background decoration. The controlling specifications are `SOLID_TERRAIN_NAVIGATION_AND_LEVEL_COMPOSER.md` and `TILE_ASSET_PIPELINE_AND_LEVEL_COMPOSER.md`.

### Content files

Terrain-enabled levels are split across:

```text
content/levels/             timeline and encounters
content/levelPackages/      package references
content/maps/               visual material cells and semantic layers
content/collision/          authoritative corridor geometry
content/routes/             intended safe route and clearance
content/terrainObjects/     gates and barriers
content/biomes/             material presentation and behaviour
```

Do not tune collision by changing visual cliff cells. Edit `collision/*.json` or use Collision mode in the Composer.

### Grid and layers

```text
tileSize:    32
worldWidth: 544
columns:     17
chunkRows:   16
```

Collision-aligned layers must use `scrollRatio: 1`. Typical visual ratios:

```text
distant backdrop: 0.10–0.50
interactive terrain: 1.00
overhead weather: 1.15–1.50
```

### Primary tuning variables

| Variable                      | Effect                                      |
| ----------------------------- | ------------------------------------------- |
| corridor width                | precision required from the player          |
| scroll speed                  | time available to read and enter the route  |
| narrowing rate                | how abruptly the route changes              |
| route-center shift            | lateral movement demand                     |
| gate opening and warning time | passage difficulty                          |
| contact damage                | consequence of collision                    |
| navigation radius             | loadout-specific required clearance         |
| enemy pressure                | divided attention during constrained flight |

Initial clear-width targets for the visible 540px playfield, measured after accounting for the navigation hull:

```text
tutorial:             280 px
normal combat:        220 px
advanced:             170 px
brief precision gate: 130 px
challenge-only:       <130 px with explicit rules
```

The Composer calculates minimum width, clearance, and reaction time. The first reaction model estimates:

```text
availableTime = verticalDistance / scrollSpeed
lateralTravel = horizontalRouteShift / lateralShipSpeed
reactionTime = availableTime - lateralTravel
```

A negative value is an export-blocking error. Less than roughly 0.55 seconds is a warning. Ordinary tutorial narrowing should provide substantially more time—target 1.5 seconds or greater during manual playtesting.

### Collision and damage

`contactDamage` and `lethalContact` live in `collision/*.json`. Campaign defaults use damage plus separation and existing invulnerability. Lethal contact should be reserved for explicit challenge content.

`blocksPlayerProjectiles` and `blocksEnemyProjectiles` determine whether corridor walls absorb bullets. Gates and barriers always use their authored geometry.

Swept collision is active for ships and projectiles, so test high-speed propulsion and accelerated debug time as well as the starter loadout.

### Dynamic terrain

Gate properties:

- `worldY`, `x`, `width`, `height`;
- `openingWidth`;
- `initialState`;
- contact `damage`.

Barrier properties add:

- `hitPoints`;
- `creditValue`.

Timeline events use:

```json
{ "at": 46, "type": "terrainState", "target": "canyon_gate_alpha", "state": "open" }
```

Target IDs must exist. Seek and checkpoint retry reconstruct state automatically.

### Combined pressure rule

Do not tune terrain and encounters independently. As corridor width falls, reduce at least one of:

- simultaneous enemy count;
- projectile density;
- lateral spread;
- unpredictable entry direction;
- pickup-placement pressure;
- foreground visual clutter.

The Composer flags difficulty-four/five encounters that overlap narrow corridor samples.

### Autotile tuning

Cells may store a four-bit N/E/S/W `variant`. Autotile mode recalculates cardinal variants and regenerates the first natural boundary overlay on collision-aligned surfaces. Use ordinary Paint mode for deliberate exceptions.

### Debug and telemetry

Use the Composer's collision and route overlays for geometry. In the game, use invulnerability and time scaling to test the full corridor, then repeat at normal speed. Physical keyboard, controller, and touch tests are all required before reducing clearances.

## 9. The fastest way to tune (workflow)

1. `npm run dev`, play to the moment you want to change.
2. In dev builds, press **`` ` ``** for the debug overlay (shows level time and the
   active encounter), and **`.`/`,`** to jump ±10 seconds so you don't replay from
   the start. **`C`** cycles checkpoints.
3. Edit the relevant JSON. Save.
4. The browser hot-reloads. Jump back to the moment and check it.
5. Useful debug keys while tuning: **`H`** hitboxes, **`I`** invulnerability (tune
   without dying), **`K`** kill all, **`[` / `]`** slow-mo/fast-forward, **`1/2/3`**
   set weapon level, **`F1–F8`** spawn one enemy on each movement pattern, **`4–0`**
   spawn each formation.

## 10. When something breaks

The game fails loudly. If a JSON file has a typo, a missing field, or points at an
id that doesn't exist, you get a red panel listing every problem with the file and
field. Common ones:

- _"movementPattern 'sine_decsent' not found"_ — typo in an id, or the movement
  file doesn't exist.
- _"angles length must equal count"_ — you changed `count` but not `angles` (or
  vice-versa).
- _"id 'x' must match filename 'y'"_ — rename the file or the `id` so they agree.

Fix the file, save, reload — no rebuild needed.

---

## Quptck reference: "I want to…"

| Goal                              | Edit                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Make an enemy die faster/slower   | `enemies/<id>.json` → `health`                                                 |
| Make an enemy move faster         | its `movement/<id>.json` → the speed field                                     |
| Make an enemy dodge-harder        | `enemies/<id>.json` → smaller `hitbox.radius`                                  |
| Make bullets harder to dodge      | `projectiles/<id>.json` → higher `speed`                                       |
| Make an enemy shoot more often    | `projectiles/<id>.json` → lower `cooldown`                                     |
| Change how a group is shaped      | `formations/<id>.json` → `offsetX/offsetY`                                     |
| Change when a wave arrives        | the `encounters/<id>.json` event `at`, or the `levels/<id>.json` event `at`    |
| Add a breather                    | `levels/<id>.json` → a `recovery` event                                        |
| Add a retry point                 | `levels/<id>.json` → a `checkpoint` event                                      |
| Slow the world down for a section | `levels/<id>.json` → `scrollProfile` segment, or an encounter `setScrollSpeed` |

---

## 10. Epoch 5 additions

### Multiple weapons on one enemy

An enemy's `weaponPattern` can be a **single id**, an **array of ids** (all fire
concurrently, each with its own cooldown), or `null`. The bomber uses an array:

```json
"weaponPattern": ["ring_burst", "mine_layer"]
```

### Mines

`mine_layer` is a special pattern id: instead of firing a bullet it drops a `mine`
enemy (see `enemies/mine.json`). Mines are full enemies with 1 health — shootable
for 10 points — that just sit or drift. This is why the minefield hazard and
bomber drops share one system.

### Pickups and drops

- **Drops:** an enemy's `drops` array rolls each entry independently on death.
  `{ "pickup": "weapon_upgrade", "chance": 0.5 }` = 50% chance.
- **Pickup effects** (`pickups/*.json`):
  - `weapon_upgrade` — raises your primary weapon one level.
  - `weapon_swap` — swaps your primary to `weapon` (level carries over). Blue drop.
  - `shield` — restores one hull pip; at full hull converts to +500 score.
- **Conditional drops in encounters:** `spawnPickup` takes an optional `condition`
  flag. The runner auto-sets `<enemyId>_destroyed` when the last enemy of a type
  dies, so `"condition": "heavy_fighter_destroyed"` waits until the heavy is dead.

### Secondary weapon (missiles)

The missile system is a separate slot fired with **X** (secondary fire). It homes:

```json
"homing": { "turnRateDegPerSec": 140, "acquireDelay": 0.15 }
```

`turnRateDegPerSec` is how sharply it curves (higher = tighter tracking);
`acquireDelay` is how long before it starts homing. No target → flies straight.

### Score multiplier (tuning is in code, not JSON)

The multiplier lives in `MultiplierSystem.ts` (it's a core rule, not content).
Kills fill a meter (0.2 per kill); filling it advances a tier (×1→×5); taking
damage clears the meter and drops a tier; a 2.5s lull starts it decaying. Three
kills within 0.6s grant a flat bonus. To retune feel, edit the `CONFIG` object at
the top of that file.

### Minefield hazard

An encounter event scatters mines across a rectangle:

```json
{
  "at": 0.5,
  "type": "spawnHazard",
  "hazard": "minefield",
  "x": 40,
  "y": -40,
  "w": 460,
  "h": 500,
  "count": 18
}
```

Pair it with a `setScrollSpeed` slow-down and a `shield` pickup mid-field for a
navigation-puzzle beat.

### New debug keys (Epoch 5)

`Q` toggle primary weapon (pulse ↔ spread) · `X` fire missiles.

---

## 11. Bosses (`bosses/*.json`)

A boss is choreography over the systems you already know. It has phases gated by
health percentage; each phase has its own movement, weapon patterns, and optional
destructible parts.

```json
{
  "id": "miniboss_alpha",
  "displayName": "Sentinel",
  "sprite": "tex_boss_mini",
  "totalHealth": 600,
  "hitboxRadius": 40,
  "defeatDuration": 2.5,
  "enrage": { "afterSeconds": 45, "cooldownMultiplier": 0.6 },
  "phases": [
    {
      "name": "Opening Salvo",
      "healthThreshold": 0.5,
      "movement": "boss_patrol_slow",
      "weaponPatterns": ["three_way_aimed", "ring_burst"],
      "telegraphDuration": 1.0
    },
    {
      "name": "Frenzy",
      "healthThreshold": 0.0,
      "movement": "boss_patrol_fast",
      "weaponPatterns": ["five_way_spread", "boss_aimed_volley"]
    }
  ]
}
```

| Field                        | What it does                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `totalHealth`                | Total HP across all phases                                                                      |
| `hitboxRadius`               | Size of the main body's target area                                                             |
| `phases[].healthThreshold`   | This phase is active while hp% is **above** it. List phases high→low; the last should be `0.0`. |
| `phases[].movement`          | A movement pattern id (usually a `patrol`)                                                      |
| `phases[].weaponPatterns`    | Array of projectile-pattern ids that all fire at once                                           |
| `phases[].telegraphDuration` | Seconds the boss flashes/pauses before the phase's attacks begin                                |
| `phases[].parts`             | Destructible components (see below)                                                             |
| `enrage`                     | After `afterSeconds`, all cooldowns are multiplied by `cooldownMultiplier` (<1 = faster)        |
| `defeatDuration`             | Length of the explosion sequence before victory                                                 |

**Destructible parts** (e.g. side turrets):

```json
"parts": [
  { "id": "turret_left", "offsetX": -70, "offsetY": 10,
    "health": 150, "radius": 18,
    "weaponPattern": "turret_part_shot", "scoreValue": 300 }
]
```

Parts have their own health and fire their own pattern until destroyed. Destroying
one stops its fire and awards its score; the main body keeps taking damage
independently.

**Sweeping fire** — the `angleSweep` field on a projectile pattern rotates the whole
(unaimed) fan over time, creating a moving wall:

```json
"angleSweep": { "from": -40, "to": 40, "period": 3 }
```

`period` is seconds for a full from→to→from cycle.

**Running a boss** — a boss is triggered by an encounter event, and the level
timeline waits for it (the fight is a strict gate):

```json
{ "at": 2, "type": "startBoss", "boss": "boss_alpha" }
```

Use `startMiniboss` or `startBoss` (same effect; the names document intent).

**Dev key:** `B` force-advances the boss to its next phase for fast iteration.

---

## 12. Menu & Help

The game opens on a menu (Start Game / How to Play). The **How to Play** screen is a
paged reference covering controls, weapons, pickups, survival, the multiplier, and
bosses — reachable any time from the menu. Menu navigation: ↑↓ + Enter, or click.

---

## 13. Difficulty (`difficulty.json`)

One file scales the whole game without touching any other content (PDR §15). The
same Level 01 plays on all three settings — modifiers are applied at the moment
each value is used, never by rewriting content.

```json
{
  "id": "difficulty",
  "levels": {
    "easy": {
      "enemyHealthMultiplier": 0.85,
      "projectileSpeedMultiplier": 0.85,
      "spawnDelayMultiplier": 1.2
    },
    "normal": {
      "enemyHealthMultiplier": 1.0,
      "projectileSpeedMultiplier": 1.0,
      "spawnDelayMultiplier": 1.0
    },
    "hard": {
      "enemyHealthMultiplier": 1.15,
      "projectileSpeedMultiplier": 1.2,
      "spawnDelayMultiplier": 0.85
    }
  }
}
```

- `enemyHealthMultiplier` — scales every enemy's HP on spawn.
- `projectileSpeedMultiplier` — scales enemy bullet speed (the biggest felt
  difference — faster bullets are much harder to dodge).
- `spawnDelayMultiplier` — scales formation member delays (>1 = waves stream in
  slower and gentler; <1 = tighter, more overlapping pressure).

The player picks the setting on the menu (←→). To retune, edit the numbers here —
no code changes.

## 14. Level assembly (`levels/level_01.json`)

Level 01 is now **Canyon Approach**. Its original encounter structure remains, but it references `level_01_canyon`, which joins the visual map, collision corridor, safe route, terrain objects, and canyon biome.

The canyon package demonstrates river parallax, solid cliffs, a timed gate at approximately 46–65 seconds, a destructible barrier, overhead dust, and combat-pressure checks. The terrain package is a vertical-slice segment; later level time returns to an open playfield.

When adding terrain to another level:

1. author or copy the six package documents;
2. add `levelPackage` to the level definition;
3. validate cross-file IDs;
4. ensure all approved navigation hulls have legal routes;
5. add timeline terrain-state events only after objects exist;
6. preview from relevant events and checkpoints.

---

## 15. The Level Composer (`/editor.html`)

Run `npm run dev` and open **http://localhost:5173/editor.html**.

### Spatial workspace

Modes:

- **Paint** — place or erase material cells;
- **Autotile** — paint and regenerate cardinal edge variants;
- **Collision** — drag the nearest left/right corridor sample;
- **Routes** — drag the safe-route centerline;
- **Objects** — reposition the nearest gate or barrier;
- **Analysis** — inspect without editing.

Controls include row navigation, zoom, fill viewport, material selection, layer visibility, lock, solo, ordering, largest-hull preview, clearance/reaction analysis, and combined combat-pressure warnings.

The internal canvas is 544×960 and shows 30 rows at a time. The game crops two pixels per side to retain the 540px visible playfield.

### Timeline workspace

Timeline events use stable editor IDs. Add or edit:

- encounters;
- recovery windows;
- checkpoints;
- terrain-state events.

The intensity strip marks terrain events independently from encounter difficulty.

### Preview workspace

Preview uses unsaved level and terrain data through a local overlay. It does not mutate the canonical `ContentRegistry`. Play from the start or selected timeline event, then use normal debug controls inside the frame.

### Undo, autosave, import, and export

- Each committed edit is an immutable undo/redo snapshot.
- Projects autosave per level.
- **Export Package** downloads the level, manifest, map, collision, routes, objects, and biome files.
- **Import Package** accepts all exported JSON files together and reconstructs the project.
- Export is blocked when any required file, reference, tile, terrain target, collision definition, or legal route is invalid.

Place exported files in their matching `src/content/` folders before committing them.

### Fast terrain-authoring loop

1. Select the level and Spatial workspace.
2. Paint the terrain surface or use Autotile.
3. Shape collision independently.
4. Move the route and clear all export-blocking errors.
5. Check combined encounter pressure.
6. Add gate events in Timeline.
7. Preview from the relevant event.
8. Export and re-import once before committing.

## 16. Settings & audio (Epoch 9)

Player-facing settings live in the **Settings** screen (menu or pause), persisted to
`localStorage` (`skyforge_save_v1`): master/music/sfx volume, screen shake, flash
intensity, reduced particles, touch sensitivity, and difficulty. These are runtime
preferences, not content — they're not in JSON. A corrupt save is detected and
reset rather than crashing.

Audio is fully generated (WebAudio synth) so there's no asset dependency yet; to
swap in real audio later, replace the synth calls in `AudioManager.ts` with buffer
playback — the category/concurrency/priority structure stays.

## 17. Controls summary (all devices)

- **Keyboard:** move WASD/arrows · fire SPACE · missiles X · focus SHIFT · pause ESC
- **Gamepad:** left stick/d-pad move · A fire · X missiles · B special · RB focus · Start pause
- **Touch:** drag anywhere to move (relative, finger never covers the ship) · auto-fire
  while touching · on-screen buttons for missiles and pause. Sensitivity is a setting.

The active device is whichever last produced input — no mode switch needed.

## 18. Adaptive music cues (Epoch 9R)

Music definitions live in `src/content/music/*.json` and are validated at startup and in tests.

Example structure:

```json
{
  "id": "coastal_assault",
  "displayName": "Coastal Assault — Retro FM Demo",
  "bpm": 128,
  "beatsPerBar": 4,
  "loopStartSeconds": 0,
  "loopEndSeconds": 60,
  "stems": [
    {
      "id": "drums",
      "asset": "audio/music/mission_01/mission_01_drums.ogg",
      "defaultGain": 0.9,
      "gains": {
        "recovery": 0.2,
        "normal": 0.62,
        "combat": 0.85,
        "critical": 1.0,
        "boss": 1.08
      }
    }
  ]
}
```

### Tuning rules

- Do not change one stem's length, BPM, leading silence, or loop boundary independently.
- Keep `defaultGain × state gain` below a level that clips the shared music bus.
- Use state gains to change orchestration, not to master the final soundtrack.
- Recovery should usually retain harmony or atmosphere while reducing percussion and lead.
- Boss may temporarily use the same cue at maximum intensity, but final production should supply a dedicated cue.
- Cue asset paths are relative to Vite's public base and must not begin with `/`.
- A level's `music` field must match an ID in `src/content/music/`.

The current threat model is in `MusicIntensityModel.ts`. It considers active enemies, enemy projectile count, boss presence, and player hull. Threshold changes must include unit-test updates and playtesting; lowering dwell time too far will make layers flicker.

### Debugging

Enable debug mode and inspect:

```text
music: coastal_assault combat b12.3 (running)
```

The line reports cue, adaptive state, bar/beat, and AudioContext state. If the cue is pending, interact with the page once to satisfy browser audio policy.

## 19. Mobile quality and touch tuning (Epoch 9R)

`RuntimeQualityProfile.ts` selects run-start limits:

| Profile           | Enemy bullet pool | Particle scale |
| ----------------- | ----------------: | -------------: |
| Desktop/default   |               500 |            1.0 |
| Touch-primary     |               300 |            0.5 |
| Reduced particles |       device pool |            0.5 |

Touch sensitivity is stored in settings and applied through `InputManager.setTouchSensitivity()`. Action-button exclusion zones are defined by `TOUCH_LAYOUT`; update both visual placement and exclusion geometry together.

Because pools are preallocated, quality changes take effect on the next run rather than resizing live pools.

## 20. Release verification commands

```sh
npm run typecheck
npm run lint
npm test
npm run build:base:verify
npm run test:e2e
```

`build:base:verify` builds with `/skyforge/` as the application base and confirms that generated HTML and copied music assets are compatible with project-page deployment.

The Playwright suite requires an installed Chromium binary and permission to access the local test server. CI installs the supported browser automatically.

## 21. Equipment and economy tuning (Epoch 10)

### Equipment balance

Tune equipment as packages, not isolated maximum values. Each tier should contain side-grades with different pressure points:

- damage versus energy per volley;
- shield capacity versus recharge delay;
- generator capacity versus regeneration;
- maximum speed versus acceleration and effective mass;
- defense versus the navigation envelope required by terrain.

Use `ShipStatCalculator.statHash` to identify the exact calculated build used during telemetry or playtest notes. Never tune Phaser movement constants independently from the calculator.

### Economy targets

Credits are integers and independent from score. Balance around the complete settlement loop:

```text
enemy + ground + pickup + boss + mission reward + difficulty bonus
```

A first successful mission should make several tier-one choices affordable, but should not buy the entire tier. Failed runs must not preserve post-checkpoint escrow. Debug `G` grants are for mechanical QA only and must never be used for economy conclusions.

### Checkpoint testing

For every reward-bearing encounter:

1. collect rewards before a checkpoint;
2. cross the checkpoint;
3. collect later rewards;
4. die and retry;
5. confirm protected credits remain, later credits roll back, and later rewards can be earned once again;
6. repeat the mission settlement and confirm the persistent bank changes only once per run ID.

Reward sequence and drop-RNG state are part of the checkpoint snapshot. Changes to spawn order, drop generation, or timeline seek must retain those deterministic contracts.

### Affordability telemetry

Record at minimum:

- credits banked per successful mission and per checkpoint;
- percentage of catalog affordable after each mission;
- first purchase and first upgrade choice;
- unused purchases refunded versus used items resold;
- loadout validation failures by code;
- mission success, damage received, and completion time by stat hash.

Do not raise prices solely to extend playtime. Prices should create meaningful near-term choices and permit experimentation through the unused-item refund policy.

---

## Game Design Studio tuning-package workflow

Epoch 12 moves authored balance data into the `.sftuning` package boundary defined by `GAME_DESIGN_STUDIO_ARCHITECTURE.md`.

The package owns:

- difficulty multipliers;
- enemy health, speed, rewards, movement and weapon references;
- weapon and projectile definitions;
- formations and encounters;
- bosses and pickups;
- equipment and progression values.

The Tuning workspace generates bounded controls from the active `.sftuning` package and applies validated changes to the embedded runtime. It supports isolated arenas, snapshot-assisted seeking, telemetry, A/B comparison, and Markdown review diffs. The built-in registry can be restored without reloading the Studio.

A level package must reference a compatible Tuning Pack through its manifest dependency. The package compiler blocks missing or incompatible tuning dependencies before a compiled-content manifest is produced.

## Epoch 13 live simulation workflow

1. Open `studio.html` and select **Tuning**.
2. Start the embedded runtime.
3. Choose an arena scope: level, enemy, weapon, formation, encounter, boss, route, or loadout.
4. Select the content ID where applicable and enable repeat or auto-fire.
5. Choose the relevant tuning category and content owner.
6. Adjust the generated slider or numeric input. The candidate package is validated and applied to the runtime on arena reset.
7. Use the video transport to pause, step, seek, change speed, or loop a section.
8. Use attention markers to jump to encounters, recovery periods, terrain events, checkpoints, peaks, and boss moments.
9. Capture telemetry as A, modify tuning, run the same scope, and capture B.
10. Review mean enemy count, projectile peak, mean intensity, minimum survivability, and p95 frame time.
11. Export the tuning review Markdown, then export the `.sftuning` package when approved.

### Snapshot interval

The author may select 2, 5, or 10 seconds. Shorter intervals improve seek fidelity but retain more in-memory entity state. Snapshots are bounded and runtime-only; they are not written to the tuning or level package.

### Seek limitations

Snapshot seeking is designed for editing speed, not replay certification. It restores player resources, terrain, score, multiplier tier, enemies, weapon timing, projectile pools, pickups, and boss identity. Particle systems, transient sounds, exact boss phase internals, and collision contact caches may differ after a seek. Confirm final timing with an uninterrupted playthrough before shipping a level.

### Live-overlay safety

The Studio overlay is local to the embedded runtime. It does not overwrite source JSON or canonical package data until the author explicitly saves or exports. Use **Restore Baseline** to return to the current A baseline, or reload the runtime to return to built-in content.


## Asset Studio reference workflow

Visual changes should not be made by editing tuning JSON file paths. The Asset Studio publishes stable asset IDs, and Tuning Pack definitions reference those IDs.

Use the Asset Studio **References** panel to identify missing, candidate, or rejected visuals. A replacement operation creates a new tuning candidate; review it in the Tuning workspace before export. Do not approve balance changes merely because an asset looks larger or smaller. Confirm gameplay collision, visual collision preview, shadow, hardpoints, and scale separately in an isolated simulation arena.

For aircraft readability, compare the asset in neutral, canyon, ice, space, station, and combat contexts. Keep airborne shadows separate from the aircraft sprite so altitude and ground/air separation can be tuned without regenerating artwork.



## Music Studio authoring and tuning workflow (Epoch 15)

1. Confirm cue, BPM, meter, rows per beat, swing, order, and loop range.
2. Build short reusable patterns and keep hooks readable within two to four bars.
3. Audition FM instruments before committing notes.
4. Route channels by purpose—drums, bass, harmony, lead, intensity.
5. Preview each adaptive state; do not merely make every stem louder.
6. Synchronize to an encounter, terrain challenge, recovery window, or boss marker.
7. Set transition targets and confirm package compilation.
8. Render and inspect loop discontinuity before embedding resources.
9. Compare the mix against weapons, explosions, pickups, and UI in the real runtime.
10. Export only when source, render, provenance, and licensing are complete.

### FM balance

Use register, envelope, gain, and pan separation before adding voices. Dense modulation on bass, arpeggio, and lead can mask gameplay effects. Preserve headroom when all critical/boss stems are active.

### Loop review

A low discontinuity score is useful but not sufficient. Listen for cut release tails, bass phase changes, missing pickups, delayed notes crossing the boundary, and codec padding. The Studio report measures PCM boundaries; re-test after OGG/Opus/AAC conversion.

### Sample limitation

The Epoch 15 deterministic renderer does not decode sample instruments. Do not approve a final render that depends on sample channels until an approved external or production renderer supplies those stems.

## Epoch 16 collaboration and release approval

Tuning candidates should be reviewed as package revisions rather than copied over canonical JSON files.

Recommended workflow:

1. establish and export the reviewed A baseline;
2. save the candidate as a new Tuning Pack content revision;
3. generate the deterministic package change report;
4. add comments against stable JSON paths;
5. resolve all blocking comments;
6. refresh the workspace dependency lock;
7. run production compilation and the release audit.

The dependency lock detects changed package fingerprints, versions, revisions, and resource metadata. Production compilation fails on drift or unresolved blocking comments. This prevents an unreviewed balance adjustment from entering a campaign build merely because a workspace happened to contain it.

Unpacked Git folder mode stores each enemy, encounter, weapon, difficulty definition, equipment item, and related tuning object as a stable-ID file. `payload/index.json` remains authoritative for authored ordering. Human review is still required when two collaborators edit the same stable item; the system intentionally does not attempt unsafe automatic three-way semantic merging.

## Epoch 17 AI Asset Foundry assignment workflow

Generated artwork must not be assigned by manually editing `visualAssetId`, `sprite`, or `iconKey` fields. The Asset Foundry creates an explicit assignment proposal only after the candidate has been processed, runtime-tested, and approved.

Recommended sequence:

1. compile the structured asset brief and preserve the exact generation prompt;
2. import or generate one or more candidates under the same generation job;
3. process the selected source into a non-destructive sprite derivative;
4. preview the linked asset in the real runtime and record the test evidence;
5. approve the candidate only after collision, scale, shadow, hardpoint, contrast, and mobile readability checks pass;
6. create an assignment proposal against the target Tuning Pack content ID;
7. inspect the old and new visual references and all affected content;
8. apply the proposal transactionally;
9. re-run the relevant enemy, weapon, formation, encounter, boss, or loadout arena;
10. export the revised Asset and Tuning Packs together and refresh the workspace lock.

An assignment proposal records the expected previous value. Application fails if another collaborator has changed that field since the proposal was created. Re-open the affected content, review the newer assignment, and create a fresh proposal rather than overriding the stale value.

Visual replacement must not silently change gameplay balance. Collision shapes, navigation hulls, weapon origins, engine effects, and presentation scale remain separately reviewable. After assigning a larger or more visually dense sprite, re-check formation spacing, projectile readability, terrain clearance, and mobile viewport coverage even when the numerical tuning values are unchanged.
