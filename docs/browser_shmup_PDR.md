# Product Design Requirements (PDR)

## Browser-Based Vertical Scrolling Shoot-'Em-Up

**Working title:** Project Skyforge  
**Document version:** 1.0  
**Status:** Draft for implementation  
**Primary platform:** Modern desktop web browsers  
**Secondary platform:** Mobile web browsers  
**Recommended stack:** Phaser 4, TypeScript, Vite, React-based authoring tools, JSON data files, Tiled for terrain and fixed-object layouts

---

## 1. Product Summary

Project Skyforge is a browser-based vertical scrolling shoot-'em-up inspired by games such as _Tyrian 2000_, _Raptor: Call of the Shadows_, and _Stargunner_.

The product should combine:

- Responsive arcade shooting
- Hand-authored enemy formations and encounters
- Strong pacing across short, replayable levels
- Data-driven enemy, weapon, and level definitions
- A reusable encounter system
- A browser-based level-authoring workflow
- Immediate playtesting without rebuilding or reinstalling the game

The first release should focus on a polished vertical slice rather than a large campaign. The primary goal is to prove that the movement, shooting, encounter choreography, pacing, and browser performance are enjoyable.

---

## 2. Product Goals

### 2.1 Primary goals

1. Deliver a responsive, polished vertical shooter that runs directly in a web browser.
2. Create a reusable system for authoring enemy formations, encounters, and complete levels.
3. Allow designers to adjust enemy timing and placement without modifying game-engine code.
4. Maintain stable performance during dense enemy and projectile sequences.
5. Support rapid iteration through an integrated browser-based preview workflow.
6. Establish a technical foundation that can later support a full campaign, upgrades, story content, and cloud saves.

### 2.2 Secondary goals

- Support keyboard and gamepad input.
- Support touch controls on mobile devices.
- Allow content to be reskinned through data and asset replacement.
- Support multiple difficulty settings using shared encounter definitions.
- Provide telemetry hooks for balancing and playtesting.
- Make it possible to add new enemies and weapons primarily through configuration.

### 2.3 Non-goals for the first release

The initial vertical slice will not include:

- Multiplayer
- User accounts
- Cloud synchronization
- A complete campaign
- Branching story paths
- A full shop economy
- Procedurally generated levels
- Online leaderboards
- Mod support
- Console deployment
- Native mobile applications
- A general-purpose commercial level editor

---

## 3. Target Audience

### 3.1 Primary audience

Players who enjoy:

- Classic PC and arcade shooters
- Short, replayable action games
- Weapon progression
- Pattern recognition
- Score optimization
- Boss encounters
- Retro-inspired visuals with modern responsiveness

### 3.2 Secondary audience

- Players discovering the genre through browser games
- Mobile users who prefer short play sessions
- Streamers and content creators seeking accessible arcade games
- Designers interested in creating or remixing encounter data

---

## 4. Target Platforms

### 4.1 Supported browsers

The initial supported browser set should include the current stable versions of:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Apple Safari

### 4.2 Device classes

#### Desktop

Primary development target:

- Keyboard input
- Gamepad input
- Landscape display
- Minimum viewport: 1280 × 720
- Target game area: 540 × 960 or equivalent logical portrait resolution scaled within the page

#### Mobile

Secondary development target:

- Touch input
- Portrait orientation
- Drag-to-move controls
- Automatic primary fire
- One or two large action buttons
- Reduced effects density where required

### 4.3 Performance targets

Desktop target:

- 60 frames per second during normal gameplay
- No more than 16.7 milliseconds per frame under target load
- Up to approximately 1,000 active pooled projectiles, subject to device capability
- Stable input response under high projectile density

Mobile target:

- 60 frames per second on current mid-range devices where practical
- Graceful fallback to 30 frames per second on lower-powered devices
- Configurable reduction of particles, background effects, and projectile density

---

## 5. Design Principles

### 5.1 Readability before spectacle

The player must be able to distinguish:

- Player bullets
- Enemy bullets
- Enemies
- Pickups
- Collision hazards
- Background decoration

Visual effects must not obscure critical gameplay information.

### 5.2 Challenge through combinations

Difficulty should come primarily from:

- Enemy combinations
- Spawn timing
- Movement paths
- Crossfire
- Area denial
- Target prioritization
- Resource pressure

Difficulty should not rely only on increasing enemy health.

### 5.3 Introduce, practice, combine, test

New enemies and mechanics should follow this progression:

1. Introduce in isolation
2. Repeat in a safe context
3. Combine with a known threat
4. Escalate through timing or placement
5. Test during a miniboss or boss sequence

### 5.4 Pacing through intensity waves

Each level should alternate between:

- Low-pressure orientation
- Moderate engagement
- High-intensity encounters
- Recovery
- Reward
- Climactic escalation

Continuous maximum intensity should be avoided.

### 5.5 Data-driven content

Enemy statistics, movement patterns, formations, encounters, and levels should be represented as data whenever practical.

### 5.6 Rapid iteration

A designer should be able to:

1. Change a wave
2. Save the definition
3. Restart from a nearby checkpoint
4. Observe the result immediately

---

## 6. Core Gameplay Loop

1. Start a level.
2. Move the player ship within the playable area.
3. Fire primary and secondary weapons.
4. Destroy enemies and environmental targets.
5. Avoid bullets, collisions, and hazards.
6. Collect score items, health, shields, currency, or weapon upgrades.
7. Survive escalating encounters.
8. Defeat a miniboss or boss.
9. Receive a level score and performance summary.
10. Retry, continue, or return to the menu.

For the vertical slice, steps involving persistent currency and long-term upgrades may be represented by temporary in-level pickups only.

---

## 7. Vertical Slice Scope

The first playable release should include:

- One complete level lasting approximately three to five minutes
- One player ship
- Three player weapons
- Four regular enemy types
- One ground target type
- Six reusable formations
- Ten to fifteen encounters
- One miniboss
- One boss
- One environmental hazard
- Two pickup types
- One score multiplier mechanic
- Keyboard controls
- Gamepad controls
- Basic touch controls
- Pause and restart
- Title screen
- Game-over screen
- Level-complete screen
- JSON-driven level timeline
- Basic authoring and preview interface

---

## 8. Player Systems

### 8.1 Player movement

The player ship must support:

- Eight-direction movement
- Smooth acceleration and deceleration or direct arcade-style movement
- Configurable maximum speed
- Confinement to the playable area
- Keyboard, gamepad, and touch input
- Optional focused movement mode for precision dodging

Recommended default controls:

| Action         | Keyboard           | Gamepad               | Touch         |
| -------------- | ------------------ | --------------------- | ------------- |
| Move           | Arrow keys or WASD | Left stick or D-pad   | Drag          |
| Primary fire   | Space              | Primary face button   | Automatic     |
| Secondary fire | Shift or X         | Secondary face button | Action button |
| Special weapon | C                  | Shoulder button       | Action button |
| Pause          | Escape             | Start/Menu            | Pause icon    |

### 8.2 Player hitbox

The collision hitbox should be smaller than the visible ship.

Requirements:

- Visible hitbox indicator may appear during focused movement.
- Collision shape should be circular or a compact rectangle.
- Player sprite size must not be used directly as the damage hitbox.

### 8.3 Health and survivability

The vertical slice should support:

- Hull health
- Temporary invulnerability after damage
- Collision damage
- Enemy projectile damage
- Optional shield pickup
- Death animation
- Respawn or restart behavior

Recommended first implementation:

- Three hull points
- One-second invulnerability after damage
- Full level restart after death during the earliest prototype
- Optional checkpoint respawn after encounter tooling is stable

### 8.4 Weapons

The vertical slice should include:

1. **Pulse Cannon**
   - Fast, narrow forward fire
   - Good single-target damage

2. **Spread Cannon**
   - Multiple projectiles
   - Good crowd control
   - Lower damage per projectile

3. **Missile System**
   - Slower firing secondary weapon
   - Optional target seeking
   - Limited cooldown or ammunition

Each weapon definition should support:

- Projectile prefab
- Damage
- Fire interval
- Projectile speed
- Spread
- Projectile count
- Muzzle positions
- Sound
- Visual effect
- Upgrade level
- Collision category

---

## 9. Enemy Systems

### 9.1 Base enemy properties

Each enemy definition should include:

```json
{
  "id": "light_fighter",
  "displayName": "Light Fighter",
  "sprite": "enemy_light_fighter",
  "health": 20,
  "collisionDamage": 1,
  "scoreValue": 100,
  "movementPattern": "sine_descent",
  "weaponPattern": "single_aimed_shot",
  "speed": 130,
  "hitbox": {
    "type": "circle",
    "radius": 14
  },
  "drops": []
}
```

### 9.2 Initial enemy roster

#### Light Fighter

- Low health
- Fast movement
- Appears in groups
- Simple forward or aimed fire

#### Heavy Fighter

- Higher health
- Slower movement
- Multi-shot weapon
- Used as a priority target

#### Interceptor

- Enters quickly from the side
- Crosses the play area
- Tests reaction time and positioning

#### Bomber

- Slow entrance
- Fires area-denial projectiles
- May release smaller units or mines

#### Ground Turret

- Fixed to terrain
- Activated by camera or world-position trigger
- Fires aimed or sweeping patterns

### 9.3 Enemy lifecycle

Each enemy must support:

1. Pool allocation
2. Activation
3. Entrance behavior
4. Active combat behavior
5. Exit or destruction
6. Drop resolution
7. Score award
8. Pool return

Enemies should not be repeatedly constructed and destroyed during gameplay.

---

## 10. Projectile System

### 10.1 Requirements

The projectile system must support:

- Object pooling
- Player and enemy projectile categories
- Straight-line motion
- Aimed shots
- Spread patterns
- Curved movement
- Acceleration and deceleration
- Timed direction changes
- Homing behavior
- Lifetime expiration
- Off-screen deactivation
- Damage values
- Collision masks
- Sprite animation
- Optional trails

### 10.2 Pattern definitions

Projectile patterns should be represented as reusable definitions.

Example:

```json
{
  "id": "five_way_spread",
  "projectile": "enemy_orb_small",
  "count": 5,
  "angles": [-30, -15, 0, 15, 30],
  "speed": 180,
  "cooldown": 1.2
}
```

### 10.3 Performance requirements

- Projectile allocation should occur during initialization or controlled pool expansion.
- Inactive projectiles must not participate in collision checks.
- Collision shapes must remain simple.
- Particle effects must not create excessive garbage collection.
- Debug counters should show active and pooled projectile totals.

---

## 11. Movement Pattern System

Enemy movement should be reusable and parameterized.

Initial supported movement patterns:

- Straight descent
- Sine-wave descent
- Diagonal sweep
- Side-to-side patrol
- Bezier path
- Dive and retreat
- Stop-and-fire
- Orbit point
- Follow leader
- Enter, attack, exit

Example movement definition:

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

Movement patterns should expose parameters that encounters can override.

---

## 12. Formation System

A formation defines the arrangement and relative timing of multiple enemies.

### 12.1 Formation properties

- Formation ID
- Enemy type
- Number of enemies
- Relative positions
- Spawn delay between members
- Entry direction
- Shared movement pattern
- Per-member movement overrides
- Shared weapon pattern
- Per-member firing delay
- Exit condition
- Formation completion condition

### 12.2 Initial formation library

1. V formation
2. Horizontal row
3. Alternating left/right sweep
4. Staggered column
5. Pinch attack from both sides
6. Escort formation around a heavy unit

Example:

```json
{
  "id": "v_scouts",
  "members": [
    { "enemy": "light_fighter", "offsetX": 0, "offsetY": 0, "delay": 0 },
    { "enemy": "light_fighter", "offsetX": -40, "offsetY": -30, "delay": 0.15 },
    { "enemy": "light_fighter", "offsetX": 40, "offsetY": -30, "delay": 0.15 },
    { "enemy": "light_fighter", "offsetX": -80, "offsetY": -60, "delay": 0.3 },
    { "enemy": "light_fighter", "offsetX": 80, "offsetY": -60, "delay": 0.3 }
  ],
  "movement": "sine_descent"
}
```

---

## 13. Encounter System

An encounter is a reusable gameplay unit containing one or more timed events.

### 13.1 Encounter event types

- Spawn formation
- Spawn individual enemy
- Activate ground target
- Spawn hazard
- Spawn pickup
- Change background speed
- Trigger dialogue
- Play sound
- Play music cue
- Set checkpoint
- Start miniboss
- Start boss
- Wait for enemy clear
- Set completion flag

### 13.2 Encounter definition

```json
{
  "id": "canyon_crossfire_02",
  "estimatedDuration": 12,
  "difficulty": 3,
  "skillsTested": ["target_priority", "lateral_movement"],
  "events": [
    {
      "at": 0,
      "type": "spawnFormation",
      "formation": "left_sweep",
      "x": -40,
      "y": 160
    },
    {
      "at": 1.5,
      "type": "spawnFormation",
      "formation": "right_sweep",
      "x": 580,
      "y": 240
    },
    {
      "at": 3,
      "type": "activateGroundTarget",
      "targetId": "turret_03"
    },
    {
      "at": 8,
      "type": "spawnPickup",
      "pickup": "weapon_upgrade",
      "condition": "heavy_fighter_destroyed"
    }
  ]
}
```

### 13.3 Encounter completion

An encounter may complete when:

- Its duration expires
- All designated enemies are destroyed
- A target reaches an exit point
- A boss phase ends
- A scripted condition is satisfied

The system should support both timed overlap and strict encounter gates.

---

## 13A. Solid Terrain Navigation

Skyforge shall support authored solid terrain inspired by the navigation pressure of classic vertical shooters. Cliffs, canyon walls, tunnel boundaries, gates, tall structures, and hazardous banks may occupy the player's flight corridor rather than functioning as decorative ground.

### 13A.1 Core rules

- Ordinary ground remains fly-over space.
- Solid terrain uses explicit collision geometry independent from artwork.
- Player terrain collision uses a dedicated navigation hull larger than the projectile hitbox but smaller than the visible ship.
- Campaign-default contact causes one hull-damage event, separates the ship, applies normal invulnerability, and breaks the multiplier.
- Continuous contact must not damage every frame.
- An explicit challenge ruleset may make terrain contact lethal.
- Enemy and player projectiles declare data-driven terrain interaction.
- High-speed motion requires swept or sub-stepped collision to prevent tunnelling.
- Terrain and gate state must survive checkpoint restoration, timeline seek, pause/resume, and restart deterministically.

### 13A.2 Fairness requirements

- Every ordinary campaign segment must contain a continuous route for all approved ship navigation envelopes.
- Major narrowing must provide sufficient visible reaction time.
- Narrow terrain and dense projectile pressure share one difficulty budget.
- Checkpoint spawn positions must be outside expanded solid geometry and receive a short restart grace period.
- Collision edges must be visually readable and must not be hidden beneath decorative foreground art.

### 13A.3 Runtime boundaries

Use dedicated `TerrainRuntime`, `TerrainCollisionSystem`, and terrain-state services. Do not place polygon tests, chunk loading, gate state, or route validation directly in `GameScene`.

Detailed requirements are defined in `SOLID_TERRAIN_NAVIGATION_AND_LEVEL_COMPOSER.md`.

### 13A.4 Level Package v2 implementation

Terrain-enabled levels use a 32-pixel logical grid and a 544-pixel internal map width (17 columns), cropped by two pixels per side into the existing 540-pixel playfield.

A level package separates:

- timeline and encounter choreography;
- visual map layers;
- authoritative collision;
- designer safe routes;
- dynamic terrain objects;
- reusable biome/material definitions.

The first implementation uses an interpolated corridor for canyon navigation plus stable gate and barrier objects. Player and projectile movement use swept tests to prevent tunnelling. The data model is intentionally extensible to later polygon and edge-chain collision without coupling those algorithms to `GameScene`.

The current material-cell schema supports optional four-bit cardinal variants for natural and industrial autotile rendering.

---

## 14. Level Timeline System

A level is a sequence of encounters and world events.

### 14.1 Timeline requirements

- Events scheduled by elapsed level time
- Events triggered by camera or world position
- Events gated by encounter completion
- Pause and resume
- Seek to a testing timestamp
- Restart from checkpoint
- Playback speed control in development mode
- Debug visualization
- Deterministic replay where practical

### 14.2 Hybrid authoring model

Use two complementary systems:

#### Timeline-based events

Best for:

- Airborne formations
- Music synchronization
- Ambushes
- Boss phases
- Timed pickups
- Pacing control

#### World-position events

Best for:

- Ground turrets
- Buildings
- Terrain hazards
- Solid terrain gates and state changes
- Destructible scenery
- Camera-based activation
- Background-linked set pieces

### 14.3 Example level file

```json
{
  "id": "level_01",
  "displayName": "Coastal Approach",
  "music": "coastal_assault",
  "backgroundMap": "coastal_approach_map",
  "durationTarget": 240,
  "events": [
    { "at": 2, "encounter": "opening_scouts" },
    { "at": 18, "encounter": "turret_introduction" },
    { "at": 36, "encounter": "crossfire_combination" },
    { "at": 58, "type": "recovery" },
    { "at": 68, "encounter": "interceptor_ambush" },
    { "at": 100, "encounter": "miniboss_alpha" },
    { "at": 145, "encounter": "minefield" },
    { "at": 195, "encounter": "final_escalation" },
    { "at": 225, "encounter": "boss_alpha" }
  ]
}
```

---

## 15. Difficulty and Pacing

### 15.1 Difficulty variables

Difficulty may modify:

- Enemy health
- Enemy movement speed
- Projectile speed
- Projectile count
- Fire rate
- Formation spacing
- Spawn timing
- Encounter overlap
- Pickup frequency
- Boss phase duration

### 15.2 Preferred approach

Difficulty should modify the same underlying level rather than require completely separate levels.

Example:

```json
{
  "normal": {
    "enemyHealthMultiplier": 1,
    "projectileSpeedMultiplier": 1,
    "spawnDelayMultiplier": 1
  },
  "hard": {
    "enemyHealthMultiplier": 1.15,
    "projectileSpeedMultiplier": 1.2,
    "spawnDelayMultiplier": 0.85
  }
}
```

### 15.3 Intensity metadata

Each encounter should include:

- Estimated intensity from 1 to 5
- Skills tested
- Expected duration
- Expected active enemy count
- Expected projectile density
- Reward level
- Recovery requirement

The editor should eventually visualize the level’s intensity curve.

---

## 16. Boss System

### 16.1 Boss requirements

Bosses should support:

- Multiple phases
- Phase-specific movement
- Phase-specific weapons
- Destructible components
- Health thresholds
- Timed transitions
- Animation cues
- Telegraphing
- Enrage behavior
- Defeat sequence
- Encounter completion signal

### 16.2 First boss structure

Recommended first boss:

#### Phase 1

- Slow lateral movement
- Alternating aimed volleys
- Exposes the main hit area

#### Phase 2

- Deploys side turrets
- Introduces sweeping fire
- Requires movement across the full play area

#### Phase 3

- Faster movement
- Combines aimed and spread fire
- Uses a pattern previously introduced during the level

The boss should test skills already taught during the stage.

---

## 17. Pickup and Reward Systems

Initial pickups:

### Weapon upgrade

- Increases current weapon level
- Provides visible and audible feedback
- Maximum level defined per weapon

### Shield or health pickup

- Restores survivability
- May be conditionally spawned after high-difficulty encounters

Optional later pickups:

- Currency
- Score multiplier
- Temporary invulnerability
- Drone companion
- Bomb stock
- Secondary weapon ammunition

---

## 18. Scoring

The vertical slice should support:

- Base score per enemy
- Bonus for rapid group destruction
- Score multiplier
- No-damage bonus
- Boss phase bonus
- Level completion bonus

Recommended multiplier behavior:

- Destroying enemies increases a meter.
- Taking damage reduces or resets the multiplier.
- Allowing too much time between kills causes the meter to decay.
- The multiplier should encourage assertive but controlled play.

---

## 19. User Interface

### 19.1 In-game HUD

The HUD should display:

- Health or hull
- Shield status
- Current weapon
- Weapon level
- Secondary weapon status
- Score
- Multiplier
- Boss health when active
- Pause control on touch devices

### 19.2 Front-end screens

Required screens:

- Loading screen
- Title screen
- Control instructions
- Level start
- Pause menu
- Game-over screen
- Level-complete screen
- Settings screen

### 19.3 Settings

Initial settings:

- Master volume
- Music volume
- Effects volume
- Screen shake
- Flash intensity
- Reduced particles
- Control remapping for keyboard
- Touch sensitivity
- Fullscreen toggle

---

## 20. Accessibility

The initial product should consider:

- Rebindable keyboard controls
- Gamepad support
- Adjustable screen shake
- Adjustable flash intensity
- High-contrast projectile option
- Separate audio controls
- Pause at any time
- Optional automatic fire
- Touch sensitivity control
- Reduced-effects mode

Later accessibility enhancements may include:

- Color-blind palettes
- Slower practice mode
- Invulnerability practice option
- Pattern preview mode
- Subtitle support for dialogue

---

## 21. Audio

### 21.1 Browser requirements

Because browsers often block audio before user interaction, the title screen must require an explicit click, key press, gamepad input, or touch before audio begins.

### 21.2 Audio categories

- Music
- Player weapons
- Enemy weapons
- Explosions
- Pickups
- UI
- Boss cues
- Warning alarms

### 21.3 Audio behavior

- Sound effects should use pooling or controlled concurrency.
- Repeated bullet sounds should have concurrency limits.
- Important warning sounds should take priority.
- Music transitions should support boss and phase changes.
- Audio should pause or reduce appropriately when the tab loses focus.

---

### 21.4 Adaptive music and soundtrack direction

The vertical slice now includes a data-driven adaptive-music foundation. The complete requirements are maintained in `MUSIC_DIRECTION_AND_ADAPTIVE_AUDIO.md`, which is normative where it is more specific than this section.

Requirements:

- music cues are referenced by content ID rather than direct file paths in level definitions;
- mission music may contain synchronized drums, bass, harmony, lead, intensity, and atmosphere stems;
- all stems in a cue share BPM, length, loop boundaries, encoding settings, and sample-zero alignment;
- one `MusicDirector` owns musical scheduling and is separate from `GameScene` and ordinary SFX playback;
- stems begin at one shared future AudioContext time;
- adaptive changes use broad gameplay-intensity states, smoothing, hysteresis, and dwell time;
- boss lifecycle may force a boss state, with dedicated boss cues and bar-aligned transitions added as soundtrack production advances;
- pause, settings, checkpoint restart, visibility suspension, and scene shutdown must preserve synchronization or cleanly restart at a valid boundary;
- master/music/SFX settings remain persistent;
- the hangar and economy loop receive their own thematic cue and tonal transaction feedback;
- all music, samples, presets, and recordings must be original or documented as commercially licensed.

The original `coastal_assault` demonstration cue is an implementation test, not a final soundtrack deliverable.

### 21.5 Related feature addenda

- `SOLID_TERRAIN_NAVIGATION_AND_LEVEL_COMPOSER.md`

The hybrid ship loadout, credits, inventory, purchasing, generator, engine, shield, and progression design is specified in `SHIP_CONFIGURATION_EQUIPMENT_ECONOMY_PROGRESSION.md`. That addendum expands Sections 8, 17, 18, 19, 27, and 34 and becomes the normative source for Epoch 10. Epoch 10 is implemented; `EPOCH_10_IMPLEMENTATION.md` records the delivered services, content, campaign loop, tests, and known limitations.

---

## 22. Visual Direction

The specific art style remains open, but the implementation should support:

- Sprite atlases
- Animated sprites
- Multi-layer parallax
- Particle effects
- Screen shake
- Hit flashes
- Additive glow where supported
- Scalable UI
- Resolution-independent positioning

Gameplay-critical elements must remain visually distinct from the background.

---

## 23. Game Design Studio

### 23.1 Purpose

The authoring environment is a unified **Skyforge Game Design Studio**, not a single expanding level editor. It contains four specialized workspaces that share schemas, packages, validation, and the real game runtime:

1. Level Studio
2. Simulation and Tuning Lab
3. Music Studio
4. Asset Studio

The Studio must allow collaborators to exchange independently versioned content without rebuilding the engine or manually editing source files.

### 23.2 Package outputs

The Studio exports four data-only package formats:

| Workspace    | Extension      | Primary content                                                                |
| ------------ | -------------- | ------------------------------------------------------------------------------ |
| Level Studio | `.sflevelpack` | Campaigns, levels, maps, collision, routes, objects, timelines                 |
| Tuning Lab   | `.sftuning`    | Difficulty, enemies, weapons, patterns, encounters, bosses, pickups, equipment |
| Music Studio | `.sfmusic`     | Adaptive cues, instruments, tracker source metadata, runtime resources         |
| Asset Studio | `.sfassetpack` | Semantic visual assets, animations, shadows, collision previews, tilesets      |

An optional `.sfworkspace` file pins one active package of each type and the active level. The workspace contains references only.

Epoch 12 uses readable JSON envelopes with custom extensions. Packed ZIP transport and unpacked Git folder mode must serialize to the same logical schema in later epochs.

### 23.3 Dependency rules

The Level Pack may depend on tuning, music, and asset packages. Those packages must not depend on levels. All references use stable IDs and semantic version ranges.

Packages are data-only. Imported content may not execute JavaScript, WebAssembly, HTML, shader code, or plug-ins.

### 23.4 Shared runtime

Every workspace controls the same embedded Phaser runtime used by the released game. The Studio must not implement a second simplified simulation.

The runtime bridge supports:

- start and restart;
- pause and resume;
- timeline seek;
- time scale;
- observation invulnerability;
- level, time, scene, and music-state reporting.

Epoch 13 extends this bridge with live tuning overlays, snapshot-assisted reconstruction, telemetry, isolated arenas, and video-style scrubbing.

### 23.5 Level Studio

The existing spatial and timeline Composer remains the complete level-authoring surface. It provides terrain, collision, route, object, event, analysis, preview, and Level Package v2 workflows.

The Level Studio must be able to:

- send its unsaved working copy to the Studio as a `.sflevelpack`;
- load a compatible Level Pack from the Studio;
- block export for invalid geometry, routes, references, or package dependencies;
- retain stable editor identities and undo/redo.

### 23.6 Simulation and Tuning Lab

The Tuning Lab owns all behavioural and balance data. Controls are schema generated and expose numeric ranges, units, defaults, and hot-reload safety.

Required eventual simulation scopes:

- enemy;
- weapon;
- formation;
- encounter;
- boss phase;
- terrain corridor;
- full level;
- equipment loadout;
- difficulty comparison.

Epoch 12 provides validated editing and export. Epoch 13 implements live runtime application, telemetry, A/B comparison, isolated arenas, and snapshot-assisted timeline transport.

### 23.7 Video-style timeline transport

The Studio timeline becomes a central transport with play, pause, frame/event stepping, playback speed, looping, checkpoints, attention markers, and seek.

Arbitrary seek must use deterministic random seeds, periodic state snapshots, and replay from the nearest snapshot. Merely changing the level clock is insufficient for production authoring.

Timeline lanes include terrain, scroll, encounters, boss phases, rewards, music, weather, checkpoints, intensity, and review comments.

### 23.7.1 Epoch 13 implementation contract

The implemented transport uses bounded periodic snapshots and authored-event replay from the nearest anchor. A snapshot captures player defense and energy, score, multiplier tier, terrain state, live enemy movement and weapon timing, active projectile pools, pickups, and active boss identity. The Studio receives only a lightweight snapshot index; full snapshot state remains inside the runtime iframe.

The transport is intended for fast authoring navigation. It is not a competitive replay or save-state format. Particles, transient sound effects, exact boss phase internals, and low-level physics contact caches are allowed to reconstruct approximately. The Studio must label this limitation and must never use snapshots as campaign saves.

Live tuning is applied through an iframe-local overlay over the validated content registry. The source package changes only when the author edits or exports the active `.sftuning` package. Closing or restoring the Studio runtime returns the registry to its canonical baseline.

Supported simulation scopes are full level, enemy, weapon, formation, encounter, boss, route, and loadout. All scopes use the normal entity, collision, weapon, terrain, music, and difficulty systems.

### 23.8 Music Studio

The Music Studio is tracker-oriented and supports FM synthesis, sample instruments, patterns, arrangement order, adaptive stems, transitions, loop markers, and synchronized level preview.

Music packages preserve editable source metadata and runtime stem resources. Rendered audio remains the game-delivery format.

#### 23.8.1 Epoch 15 implementation contract

The implemented Music Studio owns editable tracker compositions, FM and sample instrument definitions, adaptive cue metadata, and declared audio resources. Pattern events store note, instrument, velocity, duration, and tracker effects on stable row/channel coordinates. Arrangement order, loop order, BPM, rows per beat, swing, channel routing, gain, pan, mute, solo, and master gain are package data.

FM instruments expose waveform, carrier/modulator ratios, modulation index, feedback, detune, vibrato, ADSR, gain, and pan. Sample instruments reference declared audio resources with root-note and loop metadata. Imported audio must use an approved media type and pass embedded-data, byte-count, and optional SHA-256 verification.

The Studio renders FM tracker source deterministically into synchronized stereo PCM stems and a full WAV mix. It reports loop-boundary discontinuity before runtime resources are embedded. The first renderer does not decode sample instruments; it preserves them and reports an explicit warning. Shipped gameplay continues to consume rendered resources through `MusicDirector`; it does not synthesize tracker source continuously.

Adaptive authoring controls per-state gains for recovery, normal, combat, critical, and boss states and validates boss, victory, and defeat cue targets. Runtime preview applies a transient validated Music Pack in the real game iframe, supports offset/state preview, and restores canonical content.

Audio-bearing working packages use IndexedDB. Portable `.sfmusic` output remains a data-only JSON envelope in Epoch 15; packed/folder transport, migrations, generated-resource hashing, render workers, and production compilation remain Epoch 16 responsibilities.

### 23.9 Asset Studio

The Asset Studio imports, classifies, previews, and packages ships, enemies, ground units, projectiles, effects, UI, tiles, overlays, weather, shadows, and animations.

Presentation metadata includes semantic roles, scale, pivot, collision preview, hardpoints, altitude, shadow offsets, animation definitions, tileset rules, provenance, and licensing. Behaviour remains in tuning definitions.

#### 23.9.1 Epoch 14 implementation contract

The Asset Studio accepts PNG and WebP resources and records stable IDs, dimensions, byte counts, SHA-256 hashes, embedded data where required for portability, and author/licence/source provenance. Imported resources are data-only and must pass semantic validation before they become active. Image-bearing working packages use IndexedDB so resource data is not lost to local-storage quota limits.

Asset definitions support candidate, approved, and rejected curation states; named animations; normalized pivots; presentation scale; circle, rectangle, or polygon collision previews; semantic hardpoints; altitude; and separate shadow resources with offset, scale, opacity, and softness. The Studio previews these values in multiple environments and through the same Phaser runtime used by the game.

Tileset definitions include logical tile dimensions, margins, spacing, cardinal/dual-grid/Wang rule metadata, semantic tile roles, animation references, and mask-to-tile mappings. Level Package collision remains authoritative and cannot be silently replaced by visual tileset metadata.

Atlas output must be deterministic for the same input package. Frame keys and placements are stable, generated atlas resources are hashed, and overlapping frame rectangles are prohibited. The first implementation uses deterministic shelf packing; optimal packing and dead-resource removal are production-compiler concerns.

The Studio reports missing, candidate, rejected, and unused visual references against Tuning Pack content. Reference replacement produces a new candidate tuning value rather than mutating the source package silently.

### 23.10 Content compiler

The Studio compiler must resolve dependencies, validate versions, reject duplicate IDs, validate cross-package references, produce a deterministic fingerprint, and report all errors before a game build is assembled.

Later compiler stages add atlas packing, audio rendering, resource hashes, dead-resource removal, and production build integration.

### 23.11 Collaboration

Initial collaboration is asynchronous through package exchange, shared folders, and Git. Packages include authors, versions, timestamps, licenses, and dependencies. Real-time multi-user editing is deferred until package migrations and conflict rules are stable.

### 23.12 Governing document

Detailed package schemas, security boundaries, compiler requirements, and the Epoch 12–16 sequence are defined in `GAME_DESIGN_STUDIO_ARCHITECTURE.md`.

## 24. Technical Architecture

### 24.1 Recommended stack

- Phaser 4
- TypeScript
- Vite
- React for editor and non-game UI
- JSON for content data
- Tiled for terrain and fixed-object placement
- Zod or JSON Schema for validation
- Vitest for unit testing
- Playwright for browser smoke tests
- ESLint
- Prettier
- GitHub Actions for continuous integration

### 24.2 High-level architecture

```text
Web Application
├── Game Runtime
│   ├── Phaser Scenes and Entities
│   ├── Combat, Terrain, Timeline, Economy
│   ├── Audio and Adaptive Music
│   └── Input and Persistence
├── Game Design Studio
│   ├── Level Studio
│   ├── Simulation and Tuning Lab
│   ├── Music Studio
│   ├── Asset Studio
│   ├── Shared Runtime Bridge
│   └── Package Compiler
├── Package Layer
│   ├── .sflevelpack
│   ├── .sftuning
│   ├── .sfmusic
│   ├── .sfassetpack
│   └── .sfworkspace
├── Shared Schemas and Validation
└── Runtime Resources
    ├── Sprites and Atlases
    ├── Audio and Rendered Stems
    ├── Tilemaps and Collision
    └── Fonts and UI
```

### 24.3 Suggested project structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── routes.ts
│   └── styles/
├── game/
│   ├── config/
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── PreloadScene.ts
│   │   ├── MenuScene.ts
│   │   ├── GameScene.ts
│   │   └── ResultsScene.ts
│   ├── entities/
│   │   ├── Player.ts
│   │   ├── Enemy.ts
│   │   ├── Projectile.ts
│   │   ├── Pickup.ts
│   │   └── Boss.ts
│   ├── systems/
│   │   ├── EncounterRunner.ts
│   │   ├── FormationSpawner.ts
│   │   ├── LevelTimeline.ts
│   │   ├── WeaponSystem.ts
│   │   ├── CollisionSystem.ts
│   │   ├── PoolManager.ts
│   │   ├── AudioManager.ts
│   │   ├── DifficultyManager.ts
│   │   ├── RunSession.ts
│   │   └── ContentRegistry.ts
│   ├── terrain/
│   │   ├── TerrainRuntime.ts
│   │   ├── TerrainCollisionModel.ts
│   │   ├── TerrainAnalysis.ts
│   │   └── Autotile.ts
│   ├── input/
│   ├── ui/
│   └── debug/
├── editor/
│   ├── EditorApp.tsx
│   ├── TimelinePanel.tsx
│   ├── InspectorPanel.tsx
│   ├── PreviewPanel.tsx
│   └── ValidationPanel.tsx
├── content/
│   ├── enemies/
│   ├── weapons/
│   ├── projectiles/
│   ├── movement/
│   ├── formations/
│   ├── encounters/
│   ├── levels/
│   ├── levelPackages/
│   ├── maps/
│   ├── collision/
│   ├── routes/
│   ├── terrainObjects/
│   └── biomes/
├── schemas/
├── shared/
└── main.ts
```

---

## 25. Game State Management

Required states:

- Boot
- Loading
- Main menu
- Level introduction
- Active gameplay
- Paused
- Player destroyed
- Game over
- Level complete
- Results
- Editor preview

The game should distinguish between:

- Runtime state
- Persistent settings
- Level data
- Session score
- Development/debug state

---

## 26. Asset Loading

### 26.1 Initial load

Load only:

- Title assets
- Shared player assets
- UI
- First-level assets
- Common audio

### 26.2 Deferred loading

Load later content:

- Additional levels
- Boss-specific assets
- Music
- Cinematics
- Optional high-resolution effects

### 26.3 Requirements

- Display loading progress.
- Handle missing assets gracefully in development.
- Use sprite atlases.
- Compress audio appropriately.
- Avoid downloading the entire campaign at startup.

---

## 27. Save Data

The vertical slice only requires local browser storage.

Store:

- Settings
- High score
- Best completion time
- Highest multiplier
- Control preferences
- Completed tutorial flag

Future versions may add:

- Campaign progress
- Weapon inventory
- Currency
- Achievements
- Cloud synchronization

---

## 28. Telemetry and Playtesting

Development builds should record:

- Player deaths by timestamp
- Player damage locations
- Encounter completion times
- Enemies missed
- Weapon usage
- Average multiplier
- Frame-rate drops
- Active projectile peaks
- Retry frequency
- Boss phase duration

For the vertical slice, telemetry may be stored locally and exported as JSON. External analytics should not be required.

---

## 29. Debugging Tools

Development mode should include:

- Hitbox display
- Player invulnerability
- Level time display
- Encounter name display
- Active enemy count
- Active projectile count
- Pool utilization
- Frame time
- Skip to encounter
- Restart encounter
- Slow motion
- Disable background effects
- Force weapon level
- Force boss phase

---

## 30. Testing Strategy

### 30.1 Unit tests

Test:

- Weapon cooldown calculations
- Difficulty modifiers
- Formation position calculations
- Encounter parsing
- Timeline ordering
- Data validation
- Score multiplier behavior
- Pool activation and release

### 30.2 Integration tests

Test:

- Level loading
- Encounter spawning
- Boss phase transitions
- Game-over behavior
- Pause and resume
- Input switching
- Save and load settings

### 30.3 Browser tests

Use automated smoke tests to confirm:

- Application loads
- Start action unlocks audio
- Game scene launches
- Keyboard input moves the player
- Pause menu opens
- Level definition loads
- No blocking console errors occur

### 30.4 Manual playtesting

Evaluate:

- Responsiveness
- Difficulty curve
- Readability
- Encounter repetition
- Recovery periods
- Boss fairness
- Weapon balance
- Mobile control comfort
- Browser performance

---

## 31. Acceptance Criteria

The vertical slice is complete when:

1. The game loads from a public URL in supported browsers.
2. The player can complete one full level.
3. Keyboard and gamepad controls work.
4. Touch controls work on a current mobile browser.
5. The game maintains the target frame rate under intended projectile density on the reference desktop device.
6. No recurring gameplay object allocation causes visible stutter.
7. All regular enemies are defined through reusable data.
8. All enemy waves are spawned through formations or encounters.
9. The level timeline can be edited without changing game runtime code.
10. A designer can launch a preview from a selected event.
11. The level includes visible intensity peaks and recovery periods.
12. The boss contains at least three distinct phases.
13. Settings persist in local storage.
14. The game provides a complete title-to-results flow.
15. Missing content references are detected by validation.
16. No critical browser-console errors occur during a complete playthrough.
17. Terrain artwork and collision are stored independently.
18. A terrain-enabled level loads from a validated multi-file package.
19. Approved ship navigation hulls have a continuous legal route.
20. Player and projectile terrain collision does not tunnel at supported speeds.
21. Terrain state reconstructs correctly after seek and checkpoint retry.
22. The Composer can paint, erase, autotile, edit collision/routes, undo/redo, validate, preview, import, and export.
23. Invalid or incomplete terrain packages are blocked from export.
24. The canyon slice demonstrates parallax, solid navigation, a timed gate, and a destructible barrier.
25. Terrain rendering, collision, autotiling, and route analysis remain outside `GameScene`.
26. The Studio exports independently valid level, tuning, music, and asset packages.
27. A workspace resolves one compatible package of each type and reports missing dependencies.
28. Imported packages are data-only and cannot execute code.
29. The Level Studio can capture its unsaved working copy as a Level Pack.
30. The Studio embeds and controls the production Phaser runtime rather than a duplicate simulator.
31. The package compiler produces a deterministic fingerprint and blocks invalid cross-package references.

---

## 32. Development Phases

### Phase 1: Technical prototype

Deliver:

- Phaser project setup
- Player movement
- Primary weapon
- One enemy
- Projectile pooling
- Collision
- Scrolling background
- Basic performance counter

Exit condition:

A player can move, shoot, destroy enemies, take damage, and restart.

### Phase 2: Data-driven combat

Deliver:

- Enemy definitions
- Weapon definitions
- Movement patterns
- Projectile patterns
- Formation definitions
- Runtime validation

Exit condition:

New enemy and weapon variants can be created primarily through data.

### Phase 3: Encounter and timeline systems

Deliver:

- Encounter runner
- Level timeline
- Timed spawning
- World-position triggers
- Checkpoints
- Debug seeking

Exit condition:

A complete three-minute level can run from a data file.

### Phase 4: Content authoring

Deliver:

- Minimal React editor
- Event list
- Inspector
- Preview
- Save and load
- Validation

Exit condition:

A designer can adjust timing and placement without editing source code.

### Phase 5: Vertical slice content

Deliver:

- Full enemy roster
- Formation library
- Ten to fifteen encounters
- Miniboss
- Boss
- Pickups
- Score system
- Final level pacing

Exit condition:

The level is playable from start to finish and ready for balancing.

### Phase 6: Polish and release

Deliver:

- Audio
- Visual effects
- Mobile controls
- Settings
- Accessibility options
- Browser testing
- Deployment
- Performance optimization

Exit condition:

The game meets all vertical-slice acceptance criteria.

---

## 33. Risks and Mitigations

### Risk: Projectile-heavy scenes reduce browser performance

Mitigation:

- Object pooling
- Simple collision shapes
- Inactive-object filtering
- Configurable effects density
- Performance budgets
- Mobile-specific caps

### Risk: The Studio becomes larger than the game

Mitigation:

- Build specialist workspaces in separate release-gated epochs.
- Embed the real runtime instead of maintaining a second simulator.
- Keep package schemas and compiler services independent from React UI.
- Require every Studio feature to produce a testable package or runtime workflow.
- Defer real-time collaboration until migrations and conflict rules are stable.

### Risk: Encounters feel repetitive

Mitigation:

- Tag encounters by skill and intensity
- Avoid repeating the same skill test consecutively
- Vary timing, direction, and enemy combinations
- Insert recovery and reward sections
- Reuse formations with meaningful modifiers

### Risk: Mobile controls feel imprecise

Mitigation:

- Auto-fire
- Drag-anywhere movement
- Adjustable touch sensitivity
- Reduced projectile density
- Larger safe margins
- Device testing early in development

### Risk: Solid terrain feels unfair or causes tunnelling

Mitigation:

- Use swept collision and chunk-indexed authoritative geometry
- Keep collision shapes smaller than visual terrain edges where appropriate
- Validate route clearance and reaction time in the Composer
- Test every approved ship envelope and input device
- Share difficulty budget between terrain precision and projectile pressure
- Record collision heatmaps during playtesting

### Risk: Browser audio behaves inconsistently

Mitigation:

- Explicit start interaction
- Centralized audio manager
- Concurrency limits
- Visibility-change handling
- Browser-specific testing

### Risk: Data definitions become difficult to maintain

Mitigation:

- Shared TypeScript types
- Runtime schema validation
- Clear naming conventions
- Reference checking
- Editor dropdowns instead of free-text IDs
- Automated validation in continuous integration

---

## 34. Future Expansion

After the vertical slice is validated, the platform may expand to support:

- Full campaign
- Shops and currency
- Persistent weapon upgrades
- Multiple ships
- Sidekick drones
- Branching levels
- Secret encounters
- Challenge modes
- Daily seeded missions
- Online leaderboards
- Achievements
- Cloud saves
- Replay files
- User-generated encounter packs
- Cooperative play
- Native desktop packaging
- Progressive Web App installation

---

## 35. Recommended First Implementation Backlog

### Foundation

- Create Phaser 4 and TypeScript project
- Configure Vite
- Add linting, formatting, and tests
- Define logical game resolution
- Implement responsive scaling
- Implement game scene lifecycle

### Player

- Add movement
- Add hitbox
- Add primary fire
- Add health
- Add damage and invulnerability
- Add death and restart

### Combat

- Build projectile pool
- Build enemy pool
- Implement collision categories
- Add one enemy weapon
- Add one pickup

### Data

- Define schemas
- Load enemy JSON
- Load weapon JSON
- Load movement JSON
- Validate references

### Level systems

- Build formation spawner
- Build encounter runner
- Build level timeline
- Add debug time controls
- Add checkpoint support

### Content

- Create four enemies
- Create six formations
- Create ten encounters
- Create miniboss
- Create boss
- Assemble first level

### Editor

- Create event list
- Create inspector
- Embed game preview
- Add save and load
- Add validation panel
- Add play-from-selection

### Release

- Add title and results screens
- Add settings
- Add audio unlock flow
- Add mobile controls
- Optimize performance
- Deploy to static hosting

---

## 36. Final Recommendation

The project should be built as a browser-native Phaser application rather than as a desktop engine exported to the web.

The most important custom system is not the renderer or collision framework. It is the encounter-authoring layer that connects:

- Enemy definitions
- Movement patterns
- Projectile patterns
- Formations
- Encounters
- Level pacing

The first development objective should therefore be a small, data-driven vertical slice that proves the complete authoring-to-playtesting loop.

The project should not begin with a full campaign, persistent economy, or elaborate visual editor. It should begin with one polished level and the minimum reusable tools required to make that level enjoyable.


---

## Epoch 16 implemented collaboration and production boundary

The four Game Design Studio package types now use schema version 2. Package manifests include a positive `contentRevision`; packages and workspaces include persistent review comments. Schema-v1 inputs migrate explicitly to v2, while newer unsupported schemas fail.

A `.sflock` pins the workspace fingerprint, exact package versions and revisions, deterministic package fingerprints, and resource byte/hash metadata. Release compilation must verify the lock and reject unresolved blocking comments.

Every portable package has an equivalent unpacked Git folder representation containing one file per stable content ID, an explicit order index, resource metadata, and ordinary binary resource files. Portable and folder representations must round-trip without semantic or ordering changes.

The production compiler consumes the validated workspace, four packages and lock. It determines the live resource graph, verifies bytes and hashes, removes dead resources, writes content-addressed resource paths, strips embedded base64 from runtime packages, and emits a release manifest. Authored atlas metadata is preserved; release compilation does not use a second competing pixel packer.

Vite production output is code-split and subject to enforceable JavaScript/CSS budgets. Browser CI covers desktop Chromium plus mobile Chromium and WebKit profiles. Physical iPhone, Android, controller, audio-route and thermal checks remain manual release evidence.

Detailed authoring, conflict and release rules are defined in `PACKAGE_AUTHORING_AND_COLLABORATION.md`; implementation and findings are recorded in `EPOCH_16_IMPLEMENTATION.md` and `EPOCH_16_POST_REVIEW_AND_AUDIT.md`.

#### 23.9.2 Epoch 17 AI Asset Foundry contract

The Asset Studio includes an AI Asset Foundry. It stores structured asset briefs, exact compiled prompts, generation/edit jobs, model and optional snapshot identifiers, input-resource references, candidate lineage, processing recipes, runtime-test evidence, approval data and assignment proposals inside the Asset Pack.

Provider credentials must never exist in browser code or package data. Integrated generation is routed through a loopback backend that reads `OPENAI_API_KEY` from the environment, applies an origin allow-list and request limits, and sends fixed image generation/edit requests. Manual ChatGPT output import must create the same lineage records and remain fully supported.

Generated source art is immutable authoring evidence. A separate deterministic derivative is cropped, matte-processed, resized, alpha-thresholded and palette-reduced for game use. The source and derivative retain separate resource IDs and hashes.

A generated candidate cannot become an approved production asset until its source and derivative resolve, a linked Asset Studio definition exists, and a runtime test passes. Interactive assets warn when collision, hardpoint, mobile-readability or aircraft-shadow review is incomplete.

Assignment to gameplay content is an explicit cross-package transaction. Epoch 17 supports `Enemy.sprite` and `Equipment.iconKey`; proposals record previous and new values and reject stale application. Additional assignment adapters may be added without coupling visual generation to tuning or level placement.

Production compilation includes only resources referenced by final assets, tilesets and atlases. Raw, rejected and unused candidate resources remain in collaboration history but are removed from game builds.

Detailed requirements are defined in `AI_ASSET_FOUNDRY.md`.

## Security and collaboration requirements added in Epoch 17.2

1. All authored IDs that may identify package content or cross-package references must use the shared safe-ID grammar: ASCII letter or number first, followed only by letters, numbers, `_`, or `-`.
2. Package-folder tools must fully schema- and semantic-validate inputs before creating, deleting, or overwriting files.
3. Every generated filesystem path must be resolved and proven to remain below the selected root directory.
4. Unpack must refuse non-empty destinations unless the operator explicitly supplies `--force` after reviewing the target.
5. Paid Foundry requests require an allowed Origin, allowed Host, per-process session token, rate capacity, and concurrency capacity.
6. Mutable runtime controls may be globally exposed only in development or E2E builds. Production Studio preview must use a same-origin embedded nonce handshake.
7. Security properties must be backed by negative automated tests; implementer-authored release reviews must be identified as internal reviews.
8. API-backed generation remains experimental until an opt-in live provider smoke test passes with a maintainer-controlled key.


## Level Studio interaction requirements added in Epoch 17.3

1. The level canvas is the primary authoring surface and must retain the majority of usable workspace width.
2. Select is the default non-destructive tool. Objects are selected through geometric hit-testing and moved only after explicit selection.
3. A continuous pointer gesture is one undoable transaction, regardless of how many cells or samples it changes.
4. Navigation follows common creative-tool conventions: wheel pan, Space-drag pan, modifier-wheel zoom, fit commands and a clickable full-level minimap.
5. The active layer, active tool and active material remain visible at all times. Context changes must not silently destroy the current brush.
6. Materials are presented visually with names, collision role and animation state, plus search, recent use and eyedropper sampling.
7. Collision, routes, objects and analysis overlays are mode-sensitive and may be independently revealed.
8. The inspector is contextual and may show a selected object, map cell, layer or analytical issue. Analytical issues must support spatial navigation where coordinates are available.
9. Timeline events are displayed in semantic lanes and may be selected and repositioned directly.
10. Embedded Studio mode removes duplicate chrome and allows the simulation dock to be hidden or expanded without clipping the editor.


## Default image-backed terrain requirements added in Epoch 17.4

1. A generated concept sheet is not a runtime atlas until it has been reconstructed into an exact 32×32 grid with explicit frame assignments.
2. The retained source master and deterministic normalization script are part of the deliverable so the atlas can be rebuilt and reviewed.
3. Logical material IDs and neighbour masks are authoritative; image frame indices are derived visual data.
4. The Level Studio, Phaser runtime and built-in Asset Pack must resolve the same tileset ID, image URI and frame mapping.
5. Static variation must be deterministic by map coordinate and layer; animated terrain must use a synchronized, seek-safe clock.
6. Cardinal-16 mappings must contain all masks 0–15 and every referenced frame must be inside atlas bounds.
7. Missing or unavailable images must fail visibly or use the documented procedural fallback without altering authored map data.
8. Collision and route geometry remain independent from the image atlas and cannot be inferred silently from visual frames.
9. The default Canyon level must visibly demonstrate atlas-backed floor, cliffs, water and metal surfaces in both editor and runtime.
10. Blob-47 and dual-grid content may be reserved in an atlas before their rule engines exist, but must not be advertised as automatically applied until mechanically implemented and tested.

## Runtime architecture requirements added in Epoch 17.5

- `GameScene` is a composition root and must not directly own actor pools, mission economy, boss construction or Studio snapshot implementation.
- Boss projectile collider handles must be retained and destroyed on replacement, defeat and shutdown.
- Debug and preview asynchronous callbacks require explicit lifecycle ownership.
- The production source import graph must remain acyclic.
- Architecture budgets and browser QA are release gates for future runtime epochs.
