# Skyforge

## Solid Terrain Navigation, Collision, and Level Composer Addendum

**Document status:** Implemented Epoch 11 foundation; advanced geometry and production assets remain planned  
**Applies to:** Runtime collision, level content, checkpoint design, difficulty tuning, debug tools, Level Composer, automated validation, telemetry, and accessibility  
**Inspiration:** The solid-wall navigation pressure found in _Major Stryker_, adapted into an original Skyforge system

---

## 1. Purpose

Skyforge levels currently treat terrain primarily as scrolling presentation and as an anchor for ground targets. This addendum introduces **solid terrain navigation**: authored cliffs, walls, canyon edges, structures, ice shelves, lava banks, tunnel boundaries, and other world geometry that physically constrain the player’s flight path.

The mechanic is intended to add a second navigational demand beside projectile avoidance:

- bullets create temporary moving danger;
- solid terrain creates persistent spatial danger;
- enemy formations pressure the player toward or away from constrained routes;
- the Level Composer controls how these demands combine over time.

This must not become an automatic collision-avoidance system. The player remains responsible for steering. The game and editor must instead provide readable geometry, fair collision rules, deterministic simulation, and validation that prevents impossible or deceptive layouts.

---

## 2. Design goals

The terrain system shall:

1. Create memorable canyon, tunnel, trench, gate, bridge, and obstacle-navigation sequences.
2. Make terrain mechanically meaningful rather than purely decorative.
3. Preserve the readability and responsiveness expected of a vertical shooter.
4. Keep collision outcomes deterministic across keyboard, gamepad, and touch input.
5. Allow designers to combine terrain with encounters without creating unavoidable damage.
6. Represent collision independently from artwork so art may change without altering gameplay accidentally.
7. Support checkpoints, timeline seeking, editor preview, and deterministic testing.
8. Scale difficulty through route width, scroll speed, shape complexity, and enemy pressure rather than invisible hitbox changes.
9. Support accessibility options without removing the mechanic from the default game.
10. Integrate cleanly with future ship propulsion, handling, shield, and hull systems.

---

## 3. Core player experience

### 3.1 Terrain categories

A level may contain:

| Category           | Examples                                  | Collision behaviour                         |
| ------------------ | ----------------------------------------- | ------------------------------------------- |
| Decorative         | clouds, distant mountains, floor markings | no collision                                |
| Ground surface     | ordinary landscape beneath aircraft       | no collision for airborne player            |
| Solid boundary     | cliffs, canyon walls, tunnel walls        | blocks and damages player                   |
| Solid obstacle     | towers, arches, rock pillars, machinery   | blocks and damages player                   |
| Gate               | doors, force barriers, timed shutters     | collision depends on state                  |
| Hazardous solid    | lava bank, electrified wall, grinder      | blocks and applies configured hazard damage |
| Destructible solid | blast door, weak rock, barricade          | solid until destroyed or opened             |
| Conditional solid  | altitude barrier, phase field             | collision depends on ship/state/tag         |

Epoch 11 implements decorative/ground layers, solid corridor boundaries, timeline-controlled gates, and destructible barriers. General polygon obstacles, hazardous force zones, and conditional solids remain planned extensions.

### 3.2 Default collision consequence

Default Skyforge behaviour:

- Contact with solid terrain causes **one hull damage event**.
- The player is separated from the surface along the collision normal.
- Standard damage invulnerability applies after the event.
- Continuous contact cannot inflict damage every frame.
- Contact velocity is reduced or redirected enough to prevent repeated penetration.
- A terrain hit breaks the score multiplier unless a later accessibility mode overrides that rule.

A per-level or campaign ruleset may enable a **lethal terrain mode** for challenge content, where any solid-terrain collision destroys the ship. This reflects the harsher classic-shooter model but should not be the campaign default until playtesting proves it fair with Skyforge’s loadout and checkpoint systems.

### 3.3 Terrain is not a ground target

Solid terrain differs from tanks, turrets, buildings, and other ground targets:

- aircraft fly over ordinary ground targets unless a target is explicitly tall enough to occupy airspace;
- solid terrain occupies the player’s flight corridor;
- terrain collision masks must never be inferred from the visual sprite of a ground target;
- a bridge may be visually above the ground while still defining a solid opening or overpass boundary;
- projectiles may use separate terrain interaction rules from the player.

---

## 4. Collision model

### 4.1 Authoritative geometry

Collision geometry shall be authored as one or more of:

- axis-aligned rectangles;
- convex polygons;
- edge chains/polylines with thickness;
- tile collision shapes generated from collision-tagged terrain tiles;
- compound shapes composed from the above.

Concave regions must be decomposed into convex pieces or represented as edge chains. Artwork alpha must never be used as the authoritative collision mask.

### 4.2 Coordinate system

Terrain is defined in **level-world coordinates**, not screen coordinates. It scrolls through the camera using the same world-distance model as ground objects.

Each terrain collision object requires a stable ID:

```ts
interface TerrainColliderDef {
  id: string;
  layerId: string;
  kind: 'solid' | 'hazard' | 'gate';
  shape: RectShape | ConvexPolygonShape | EdgeChainShape;
  materialId: string;
  damage?: number;
  lethal?: boolean;
  activeFrom?: number;
  activeUntil?: number;
  triggerId?: string;
  tags?: string[];
}
```

### 4.3 Player collision body

The terrain body should be distinct from the bullet-grazing or projectile damage body.

Recommended bodies:

- **projectile hitbox:** very small central body for bullets;
- **terrain/navigation hull:** larger convex body approximating the aircraft fuselage and inner wing area;
- **pickup radius:** separate overlap shape where needed.

The terrain hull must remain smaller than the visible sprite and must not include transparent wing-tip decoration, engine glow, shadow, or weapon effects.

### 4.4 Swept collision

Because terrain and player motion can combine into high relative speed, the implementation must prevent tunnelling. Use swept or sub-stepped collision checks between previous and proposed positions.

The resolver should:

1. calculate proposed player displacement;
2. query nearby terrain using a spatial index;
3. sweep the navigation hull through the displacement;
4. move to the earliest valid contact point;
5. apply a small separation epsilon;
6. remove velocity into the collision normal;
7. emit at most one damage event for the contact episode.

Do not rely only on end-of-frame overlap checks.

### 4.5 Broad phase

Terrain collision must not test every shape every frame. Use chunk or grid indexing keyed to level-world position. Only geometry near the visible playfield and player movement envelope should be active in the broad phase.

Recommended chunk height: 512–1024 world pixels, tuned after profiling.

### 4.6 Contact state

Track contact episodes explicitly:

```ts
interface TerrainContactState {
  touchingIds: Set<string>;
  lastDamageAt: number;
  lastNormal?: { x: number; y: number };
}
```

A new damage event occurs only when:

- the player enters a new solid contact after separation; or
- the configured contact cooldown expires while the player remains trapped in a hazardous surface.

---

## 5. Projectile and enemy interaction

### 5.1 Player projectiles

Each projectile definition shall declare:

```ts
terrainInteraction: 'ignore' | 'destroy' | 'impact' | 'pierce' | 'ricochet';
```

Initial defaults:

- ordinary cannon rounds: `impact`;
- missiles: `impact` with explosion;
- beam or special weapons: data-driven;
- debug projectiles: `ignore` permitted.

### 5.2 Enemy projectiles

Enemy bullets should generally collide with solid terrain. This allows terrain to provide temporary cover and creates meaningful route decisions.

Exceptions must be explicit and visually communicated, such as:

- arcing mortar;
- ground shockwave;
- phase projectile;
- beam passing through a transparent energy field.

### 5.3 Enemies

Enemy definitions shall declare their terrain policy:

```ts
terrainPolicy: 'ignore' | 'avoid' | 'collide' | 'follow_route';
```

- High-flying enemies may `ignore` low terrain but not tunnel ceilings.
- Canyon formations should use `follow_route` with authored safe paths.
- Ground units remain constrained to ground navigation data.
- Enemies must not visibly fly through a wall unless their altitude or phase behaviour explains it.

The first implementation may restrict terrain-heavy sequences to authored enemy paths rather than general runtime pathfinding.

---

## 6. Route and fairness rules

### 6.1 Safe corridor

Every terrain segment must define or permit a continuous safe corridor for the player navigation hull.

Validation must account for:

- navigation hull dimensions;
- maximum movement speed and acceleration;
- scroll speed;
- expected input latency;
- touch-control precision;
- enemy and projectile pressure;
- gates and moving obstacles;
- checkpoint spawn position.

### 6.2 Width targets

Initial tuning targets, measured as clear navigable width after expanding terrain by the player navigation hull radius:

| Difficulty/use         |            Minimum sustained width |
| ---------------------- | ---------------------------------: |
| Tutorial terrain       |                             280 px |
| Normal combat corridor |                             220 px |
| Advanced corridor      |                             170 px |
| Brief precision gate   |                             130 px |
| Challenge-only extreme | 100 px or less, separately flagged |

These are starting values for a 540-pixel-wide playfield and must be revised through telemetry and touch-device testing.

### 6.3 Reaction distance

A major narrowing or route choice must be visible long enough to react. The editor should calculate:

```text
reactionTime = visibleApproachDistance / effectiveScrollSpeed
```

Recommended minimums:

- normal campaign: 1.5 seconds;
- high-speed advanced sequence: 1.0 second;
- tutorial introduction: 2.0 seconds or more.

Hidden or late-revealed collision geometry is prohibited unless it is a clearly telegraphed trap in optional challenge content.

### 6.4 Combined pressure budget

Terrain precision and projectile density share one difficulty budget. A narrow corridor should normally reduce:

- simultaneous enemy count;
- lateral bullet spread;
- unpredictable spawn directions;
- pickup pressure;
- visual clutter.

The intensity model and Level Composer should flag sections that combine extreme terrain precision with extreme combat pressure.

### 6.5 Recovery after collision

After a terrain hit:

- apply standard invulnerability;
- briefly reduce collision response jitter;
- preserve steering control;
- avoid spawning the player inside geometry;
- never push the player farther into a second wall;
- allow a short grace window after checkpoint restart.

---

## 7. Moving terrain and gates

Moving solids are a later sub-feature but the data model must allow them.

Examples:

- opening blast doors;
- closing shutters;
- sliding asteroid plates;
- rotating machinery;
- collapsing cave walls.

Rules:

1. Moving geometry must use deterministic timeline or trigger state.
2. A closing gate must have a warning period.
3. The player must never be crushed without an authored escape route.
4. Seeking and checkpoint restoration must reproduce gate state exactly.
5. Editor preview must support scrubbing gate state.
6. Collision resolution must consider both player and terrain velocity.

---

## 8. Level data and package format

The Level Composer package should separate visual tiles from collision and route metadata:

```text
level-package/
  level.json
  map.json
  collision.json
  routes.json
  encounters.json
  music.json
  manifest.json
```

Example `collision.json`:

```json
{
  "formatVersion": "1.0",
  "levelId": "level_02",
  "materials": [
    { "id": "rock", "kind": "solid", "damage": 1 },
    { "id": "lava_wall", "kind": "hazard", "damage": 1, "contactCooldown": 0.5 }
  ],
  "colliders": [
    {
      "id": "left_cliff_001",
      "layerId": "terrain_collision",
      "kind": "solid",
      "materialId": "rock",
      "shape": {
        "type": "polygon",
        "points": [
          [0, 0],
          [112, 0],
          [138, 420],
          [0, 420]
        ]
      }
    }
  ]
}
```

Example `routes.json`:

```json
{
  "formatVersion": "1.0",
  "levelId": "level_02",
  "playerCorridors": [
    {
      "id": "main_route",
      "fromWorldY": 0,
      "toWorldY": 12000,
      "centerline": [
        [270, 0],
        [310, 1800],
        [190, 3500]
      ],
      "minimumClearance": 170
    }
  ],
  "enemyRoutes": []
}
```

Routes are design and validation aids. Collision geometry remains authoritative at runtime.

---

## 9. Level Composer requirements

### 9.1 Collision authoring mode

The Composer shall provide a dedicated collision mode with:

- collision layer visibility toggle;
- rectangle, convex polygon, and edge-chain drawing;
- vertex editing and snapping;
- material assignment;
- collider ID and tag editing;
- collision preview expanded by the player navigation hull;
- invalid-polygon warnings;
- overlap and gap inspection;
- world-coordinate ruler;
- chunk boundaries;
- copy, mirror, duplicate, and simplify tools.

### 9.2 Route analysis mode

The Composer shall calculate and display:

- navigable free space;
- route centerline;
- minimum corridor width over time;
- reaction time to narrowing;
- unreachable pockets;
- checkpoint spawn validity;
- nearest-wall distance;
- predicted collision hotspots;
- combined terrain/combat intensity.

Suggested overlays:

- green: comfortable clearance;
- yellow: advanced precision;
- orange: brief high-risk gate;
- red: invalid or challenge-only;
- purple: no continuous route.

Do not rely on colour alone; use patterns and labels for accessibility.

### 9.3 Live flight preview

The editor must support:

- play from cursor/world position;
- ghost navigation hull display;
- hitbox and collision-normal visualization;
- speed and difficulty presets;
- keyboard, gamepad, and touch emulation;
- invulnerability and no-damage inspection modes;
- terrain-only preview with encounters disabled;
- encounter preview with terrain enabled;
- recorded input replay for regression testing.

### 9.4 Timeline integration

Terrain-related timeline events include:

```text
activate gate
deactivate gate
open gate
close gate
change terrain material state
start collapse warning
commit collapse
set terrain challenge tag
```

The timeline should show terrain geometry and encounter pressure in the same time domain while preserving separate source data.

### 9.5 Auto-validation

Standard export must be blocked when:

- collider IDs are duplicated;
- a polygon is self-intersecting or invalid;
- no continuous player route exists;
- checkpoint spawn overlaps expanded solid geometry;
- a gate can close with no valid escape under its authored timing;
- collision geometry extends outside allowed package bounds without an explicit boundary tag;
- referenced materials, triggers, or routes do not exist;
- collision chunks cannot be loaded deterministically;
- terrain and map lengths disagree;
- challenge-only widths appear in an ordinary campaign segment without an override.

Warnings, rather than hard errors, may cover unusually tight but valid sections.

---

## 10. Runtime architecture

Recommended boundaries:

```text
GameScene
├── TerrainRuntime          chunk activation and collider instances
├── TerrainCollisionSystem swept player/projectile collision and resolution
├── TerrainStateController gates and triggered state
├── RouteTelemetry         clearance and collision metrics
├── WorldScroll            shared world/camera transform
└── LevelRuntime           timeline and checkpoint orchestration
```

`GameScene` must not contain polygon tests, chunk parsing, gate state machines, or route validation directly.

### 10.1 Determinism

Given the same:

- level package;
- run seed;
- input stream;
- difficulty;
- ship configuration;
- checkpoint snapshot;

the terrain collision result must be reproducible.

### 10.2 Checkpoints and seeking

Checkpoint state must capture:

- player position;
- active terrain chunks;
- gate and destructible-terrain states;
- terrain triggers already consumed;
- grace timer;
- scroll position;
- relevant route segment.

Seeking in development mode must reconstruct these states rather than replaying every prior frame.

---

## 11. Ship configuration integration

The equipment system must expose derived handling values used by terrain validation and runtime:

- maximum speed;
- acceleration;
- deceleration;
- lateral responsiveness;
- navigation hull ID;
- terrain collision damage modifiers;
- post-impact recovery;
- optional proximity warning range.

Important rules:

1. A legal campaign loadout must be capable of completing the authored route.
2. Wider or differently shaped hulls must not silently make a route impossible.
3. The Composer should validate against one or more approved ship envelopes rather than one hard-coded sprite.
4. Engines may change handling but must not change collision geometry.
5. Shields may absorb terrain damage only if explicitly defined by equipment rules.
6. No equipment should provide automatic steering around walls in the baseline design.

A future proximity-warning module may provide audio or visual warning without changing player input.

---

## 12. Difficulty and accessibility

Difficulty may alter:

- scroll speed;
- gate timing;
- terrain damage;
- warning duration;
- post-impact grace;
- enemy pressure within constrained sections.

Difficulty must not silently alter the visual-to-collision alignment.

Accessibility options may include:

- terrain proximity outline;
- high-contrast collision-edge overlay;
- optional warning tone with stereo direction;
- reduced terrain damage;
- collision forgiveness margin;
- slower scroll in precision sections;
- non-lethal campaign terrain;
- practice mode with collision visualization.

Accessibility assistance should be explicit in settings and should not affect competitive scoring without an appropriate ruleset flag.

---

## 13. Audio and visual feedback

Terrain must be readable before contact.

Visual requirements:

- clear distinction between fly-over ground and airspace-blocking terrain;
- consistent edge language by biome;
- no collision edge hidden beneath foreground decoration;
- optional warning markings on gates and tunnel entrances;
- aircraft shadow behaviour must remain visually coherent near walls.

Contact feedback:

- directional impact flash;
- short camera impulse, respecting reduced-motion settings;
- material-specific impact particles;
- distinct terrain-impact sound;
- brief hull warning;
- debug collision normal when enabled.

Proximity warning audio, if added, must not mask enemy bullets, pickups, or the adaptive score.

---

## 14. Telemetry and balancing

Record in development builds:

- collider ID and material involved in each hit;
- world position and level time;
- player approach vector;
- distance to nearest safe centerline;
- input device;
- ship configuration;
- scroll speed;
- active encounter and intensity;
- restart/checkpoint outcome;
- repeated-hit clusters.

Editor heatmaps should identify:

- frequent impact points;
- areas where players overcorrect;
- routes with high death rates;
- differences between touch and physical controls;
- collisions caused by encounter pressure rather than geometry alone.

Do not use telemetry to move collision geometry invisibly. Revise the authored map and preserve version history.

---

## 15. Testing strategy

### 15.1 Unit tests

- polygon and rectangle intersection;
- swept hull against edge/polygon;
- earliest-time-of-impact selection;
- contact cooldown;
- collision-normal response;
- chunk indexing;
- route clearance calculation;
- reaction-time calculation;
- schema validation;
- gate state transitions.

### 15.2 Integration tests

- player cannot pass through solid wall at maximum speed;
- one contact episode causes one damage event;
- invulnerability prevents rapid repeated damage;
- bullets obey terrain interaction policy;
- checkpoint restores gate and terrain state;
- seek reconstructs active chunks;
- Pause → Settings → resume preserves terrain state;
- restart removes old collider/listener instances;
- approved ship envelopes can complete every campaign route.

### 15.3 Browser tests

- keyboard navigation through a terrain corridor;
- touch drag through a corridor without action-button interference;
- gamepad corridor navigation;
- background/resume during terrain sequence;
- GitHub Pages base-path loading of collision packages.

### 15.4 Property and fuzz tests

Generate random convex corridor segments within constraints and assert:

- no tunnelling;
- no NaN positions;
- deterministic result;
- player does not remain embedded after resolution;
- broad-phase and brute-force results agree.

---

## 16. Roadmap placement

The mechanic should be designed now but implemented after the Epoch 10 economy/loadout foundation, because terrain validation needs approved ship envelopes and handling stats.

### Epoch 10

Add only future-facing contracts:

- navigation hull ID in hull definitions;
- derived handling envelope;
- terrain damage/shield interaction policy;
- approved campaign loadout envelope tests.

Do not implement the full terrain runtime inside Epoch 10.

### Epoch 11A — Solid terrain runtime foundation

1. Collision and material schemas.
2. Chunked terrain runtime.
3. Swept player collision and deterministic response.
4. Projectile terrain policies.
5. Checkpoint/seek state.
6. Debug overlay and telemetry.

### Epoch 11B — Composer terrain authoring

1. Collision drawing/editing mode.
2. Collision/map package export.
3. Route-clearance and reaction-time analysis.
4. Live terrain flight preview.
5. Gate and trigger authoring.
6. Validation and regression replay.

### Epoch 11C — First terrain gameplay slice

1. Tutorial canyon.
2. Combat corridor.
3. Timed gate.
4. Hazard wall material.
5. Terrain-aware encounter sequence.
6. Keyboard, controller, and iPhone QA.

The prior map, procedural draft, and Asset Studio work remains in Epoch 11 but follows the collision foundation so generated maps cannot omit gameplay geometry.

---

## 17. Acceptance criteria

The first solid-terrain milestone is complete only when:

1. Collision is authored independently from artwork.
2. The player cannot tunnel through terrain at maximum supported relative speed.
3. One continuous contact produces no more than one ordinary damage event per configured contact episode.
4. The resolver separates the ship without trapping or visible jitter.
5. Projectiles follow data-driven terrain policies.
6. Terrain state survives pause, settings, checkpoint, restart, and timeline seek correctly.
7. Every campaign level has a validated continuous route for all approved ship envelopes.
8. Editor export blocks invalid collision geometry and impossible routes.
9. Major narrowing provides the required reaction time.
10. Collision edges are visually readable and match gameplay geometry.
11. Touch, keyboard, and gamepad runs are viable.
12. Debug tools display collision shapes, navigation hull, contact normal, chunk, and collider ID.
13. Telemetry can produce impact heatmaps.
14. Automated tests cover collision, chunking, route analysis, gates, and lifecycle cleanup.
15. A complete terrain vertical slice includes a canyon, gate, constrained combat, checkpoint, and recovery section.
16. The implementation does not add terrain algorithms directly to `GameScene`.

---

## 18. References and interpretation

_Major Stryker_ is used only as a high-level mechanical reference. Contemporary descriptions and the game manual establish that its levels include solid wall obstacles and that wall contact can cost a life regardless of firepower state. Skyforge adapts the underlying idea—terrain as a navigation hazard—while defining original collision, damage, editor, accessibility, and progression rules.

- Steam-hosted _Major Stryker_ manual: `https://cdn.akamai.steamstatic.com/steam/apps/358300/manuals/Manual.pdf`
- Major Stryker gameplay summary: `https://en.wikipedia.org/wiki/Major_Stryker`

---

## 19. Final recommendation

Implement solid terrain as a first-class, data-driven level system, not as decoration and not as generic physics bolted onto the player.

The correct sequence is:

1. define ship handling and navigation envelopes in Epoch 10;
2. build deterministic terrain collision and package schemas at the start of Epoch 11;
3. make route analysis and collision authoring foundational Level Composer features;
4. validate the system with one carefully paced terrain-navigation vertical slice before procedural map generation or large-scale asset production.

---

## Game Design Studio Level Pack integration

Solid-terrain geometry remains part of `.sflevelpack`. The portable Level Pack contains Level Package v2 manifests plus maps, authoritative collision, route sets, terrain objects, biomes, and timelines.

The Epoch 12 Studio bridge can capture the Level Studio's unsaved working project as a Level Pack and load a compatible Level Pack back into the editor. Asset, music, and tuning definitions are referenced through manifest dependencies rather than duplicated in the level package.

## 20. Epoch 16 locked terrain-package releases

Level Packs containing maps, collision, routes, terrain objects, and timelines can now be unpacked into Git-friendly stable-ID files and compiled under an exact workspace dependency lock.

Release compilation validates the selected package set before copying resources. Lock drift requires explicit review, and open blocking comments can prevent shipment of an impossible route, incorrect checkpoint state, unresolved collision geometry, or unapproved terrain resource. Release JSON contains no embedded binary data; live resources are verified, hashed, and emitted to content-addressed paths.

The release compiler does not infer collision from artwork and does not rewrite route geometry. The independently authored Level Package v2 collision and route data remain authoritative throughout preview, collaboration, and final compilation.
