# Project Skyforge

# Ship Configuration, Equipment, Economy, and Progression Addendum

**Model:** Hybrid vertical-shooter progression  
**Status:** Product and implementation specification for Epoch 10  
**Relationship to existing PDR:** This document supersedes the original vertical-slice assumption that persistent currency and long-term upgrades could remain deferred.

---

# Implementation status — Epoch 10

**Implemented:** 2026-07-12  
**Evidence:** `EPOCH_10_IMPLEMENTATION.md` and `VERIFICATION_REPORT.md`

The mechanical scope in this addendum is implemented with 21 equipment definitions, save v2 migration, deterministic loadout/stat services, energy and defense runtime systems, mission escrow, idempotent settlement, progression unlocks, a functional placeholder Hangar, itemized Results, and economy audio feedback.

The remaining items are production follow-through rather than missing core contracts: physical-device QA, final artwork, expanded utility-slot UI, additional missions/tiers, and long-form economy balancing.

---

## 1. Purpose

Project Skyforge will add a persistent pre-mission ship configuration and economy system inspired by the strategic appeal of 1990s PC shooters such as **Tyrian** and **Raptor: Call of the Shadows**, while remaining an original system suited to Skyforge’s current architecture.

The system must let the player earn credits through combat, bank rewards between missions, purchase and sell equipment, configure a ship, and create meaningfully different play styles through combinations of:

- hull/airframe;
- primary armament;
- secondary armament;
- optional auxiliary equipment;
- propulsion;
- power generator/core;
- shielding;
- armor;
- utility modules.

This is not merely a shop screen. It changes the complete game loop, player runtime statistics, save format, mission rewards, checkpoint behavior, telemetry, balancing, and future campaign structure.

---

## 2. Reference principles

The design takes the following broad lessons from the reference games without copying their content or exact economy:

- **Raptor:** enemies and destructible ground targets produce monetary rewards; money bonuses can be collected during missions; a hangar/supply-room loop allows supplies and weapons to be purchased between missions.
- **Tyrian:** the ship is assembled from multiple equipment categories; weapons interact with a generator/energy system; shields and armor form separate survivability layers; credits can be used to purchase equipment and improve weapons.

Skyforge will use a **hybrid model**:

- campaign progress unlocks stronger equipment tiers;
- each tier contains multiple sidegrades with real trade-offs;
- individual equipment can receive bounded upgrades;
- no single item should be universally superior across all builds and encounters;
- the player should feel stronger over time without eliminating configuration decisions.

---

## 3. Design pillars

### 3.1 Score and currency are separate

**Score** measures performance and supports high scores, multipliers, and competitive goals.

**Credits** are persistent economic value used for purchases and upgrades.

A high score must not automatically equal spendable currency. This prevents the score multiplier from destabilizing campaign balance and allows each system to be tuned independently.

### 3.2 Progression combines upgrades and sidegrades

Each campaign tier provides stronger baseline options, but the player chooses among distinct roles:

- high damage versus efficiency;
- coverage versus precision;
- speed versus armor;
- shield capacity versus recharge;
- generator output versus capacitor size;
- guided weapons versus raw projectile volume.

Higher-tier starter choices may be stronger than early equipment, but upgraded specialist equipment should remain viable for a meaningful portion of the campaign.

### 3.3 Experimentation is encouraged

The economy should not punish the player so severely for trying equipment that they hoard all credits for one known optimal item.

Use:

- clear stat comparisons;
- a same-session full refund/buyback policy;
- reasonable later resale value;
- a training range or low-risk test mode in a later sprint;
- legal fallback loadouts.

### 3.4 Persistent configuration is distinct from temporary mission power-ups

The equipped ship is selected before launch and persists in the profile.

Mission pickups may temporarily improve or alter the ship, but they do not silently overwrite owned equipment. At mission end, the ship returns to its persistent loadout unless a reward explicitly grants equipment or an unlock.

### 3.5 Every economic mutation is transactional

Buying, selling, upgrading, receiving rewards, and rolling back a mission must use explicit transactions. Credits and inventory may never be partially updated if validation fails.

### 3.6 Mechanics before assets

Epoch 10 uses placeholder icons and text. Final sprites, hangar art, equipment illustrations, and animation are outside this addendum’s acceptance gate.

---

## 4. Revised core game loop

```text
Title / Profile
      ↓
Hangar and loadout configuration
      ↓
Mission selection / launch validation
      ↓
Gameplay
  ├─ score earned
  ├─ mission credits placed in escrow
  ├─ temporary power-ups
  └─ checkpoint reward snapshots
      ↓
Results
  ├─ score summary
  ├─ credit breakdown
  ├─ bonuses / losses
  ├─ item or tier unlocks
  └─ mission records
      ↓
Bank credits and return to Hangar
```

For the first implementation, mission selection may remain fixed to Level 01. The mandatory loop is:

```text
Title → Hangar → Level 01 → Results → Hangar
```

---

## 5. Equipment categories

## 5.1 Hull / airframe

The hull defines the ship’s base identity and hard limits.

**Core fields**

- base armor/hull points;
- nominal mass;
- maximum supported mass;
- hardpoint classes;
- utility slot count;
- base drag or maneuverability coefficient;
- silhouette/collision profile reference;
- compatibility tags;
- purchase cost and unlock tier.

**Example roles**

| Hull         | Strength                      | Trade-off                   |
| ------------ | ----------------------------- | --------------------------- |
| Interceptor  | acceleration and speed        | low armor and mass capacity |
| Vanguard     | balanced                      | no extreme advantage        |
| Bulwark      | armor and heavy hardpoints    | slow handling               |
| Experimental | unusual slots or energy bonus | expensive and specialized   |

The hull should not directly contain mutable equipment state.

---

## 5.2 Primary weapon

The primary weapon is the main continuously used forward armament.

Examples:

- pulse cannon: balanced and efficient;
- spread cannon: wide coverage, lower focused damage;
- rail weapon: slow, high penetration;
- beam weapon: precise sustained drain;
- rotary cannon: spin-up, high close-range output.

**Weapon attributes**

- combat definition reference;
- compatible hardpoint classes;
- mass;
- energy per shot or per second;
- heat, if heat is later introduced;
- level/upgrade curve;
- target domain: air, ground, or both;
- role tags;
- economy fields.

The current `WeaponDef` may remain the projectile/firing definition. Persistent equipment should reference it rather than forcing shop fields into every combat formula.

---

## 5.3 Secondary weapon

The secondary slot supports limited-rate, tactical, guided, or high-impact weapons.

Examples:

- homing missiles;
- air-to-ground missiles;
- rockets;
- bombs;
- defensive interceptor drones;
- screen-clearing emergency ordnance.

Possible constraints:

- cooldown;
- ammunition capacity;
- generator charge requirement;
- target-domain restriction;
- one or more secondary hardpoints.

For Epoch 10, retain cooldown-based missiles unless ammunition is needed for the economy loop. Do not add ammunition merely because it is common in the genre.

---

## 5.4 Auxiliary / side equipment

Optional auxiliary slots provide build flavor without being mandatory for the first playable implementation.

Possible items:

- side drones;
- rear-firing weapon;
- point-defense turret;
- tractor beam for credits/pickups;
- targeting computer;
- repair nanites;
- bomb rack.

**Epoch 10 minimum:** define the schema and slot capability, but only one or two simple utilities must be implemented.

---

## 5.5 Propulsion system

Propulsion defines handling rather than raw survivability.

**Attributes**

- thrust;
- maximum speed;
- acceleration modifier;
- drag/braking response;
- focus-mode speed;
- mass;
- passive power requirement;
- optional boost behavior;
- compatibility class.

Propulsion and generator are different systems:

- **propulsion** determines movement performance;
- **generator/core** determines energy availability and recovery.

Avoid making ordinary movement continuously consume the same energy needed for weapons and shields during Epoch 10. That can produce frustrating “cannot move because I fired” states. A future boost ability may consume energy explicitly.

---

## 5.6 Generator / power core

The generator is the center of the equipment trade-off model.

**Attributes**

- energy capacity;
- energy regeneration per second;
- maximum continuous output, if modeled separately;
- passive system draw allowance;
- shield-recharge efficiency modifier;
- mass;
- cost and tier.

**Generator sidegrades**

| Generator archetype | Strength                  | Weakness                  |
| ------------------- | ------------------------- | ------------------------- |
| High-output reactor | fast energy recovery      | small reserve / high mass |
| Capacitor bank      | large burst reserve       | slow recovery             |
| Shield-coupled core | efficient shield recharge | weaker weapon sustain     |
| Lightweight cell    | low mass                  | modest total output       |

---

## 5.7 Shield system

Shields absorb damage before armor.

**Attributes**

- maximum shield points;
- recharge delay after damage;
- recharge rate;
- recharge energy cost;
- damage-type modifiers, reserved for later use;
- mass;
- passive draw;
- cost and tier.

**Shield sidegrades**

- high capacity, slow recharge;
- low capacity, rapid recharge;
- efficient shield, low maximum;
- phase-style buffer that does not naturally recharge but supplies a large reserve;
- directional shield, deferred unless encounter design requires it.

Epoch 10 should implement at least two genuinely different shield profiles.

---

## 5.8 Armor

Armor represents physical survivability after shields fail.

**Attributes**

- armor/hull bonus;
- mass;
- speed or acceleration penalty, preferably derived through mass rather than arbitrary penalties;
- repair cost behavior, if mission repair costs are later introduced;
- compatibility.

For the first implementation, armor is restored at mission start. Persistent damage/repair bills are deferred because they can turn experimentation into a grind loop.

---

## 5.9 Utility module

Utility modules modify behavior without replacing core systems.

Examples:

- credit magnet: increases money-pickup attraction radius;
- targeting computer: improves missile acquisition;
- shield regulator: reduces recharge delay;
- lightweight frame: reduces effective equipment mass;
- emergency repair: one automatic armor restore per mission;
- scanner: displays boss health/part data.

Utilities are ideal sidegrades because they support distinct player priorities.

---

# 6. Slot model

## 6.1 Minimum loadout

```ts
export interface ShipLoadout {
  id: string;
  name: string;
  hullId: string;
  primaryWeaponId: string;
  secondaryWeaponId?: string;
  propulsionId: string;
  generatorId: string;
  shieldId?: string;
  armorId?: string;
  utilityIds: string[];
}
```

## 6.2 Slot constraints

Each hull declares allowed hardpoint and equipment classes.

Examples:

```text
primary: light | medium | heavy
secondary: missile | bomb | universal
propulsion: class-1 | class-2 | class-3
generator: size-small | size-medium | size-large
shield: emitter-small | emitter-medium | emitter-large
utility slots: 0..3
```

Compatibility is data-driven. Do not encode item IDs in conditional statements.

---

# 7. Equipment data model

## 7.1 Shared equipment fields

```ts
interface EquipmentCommon {
  id: string;
  category:
    | 'hull'
    | 'primaryWeapon'
    | 'secondaryWeapon'
    | 'propulsion'
    | 'generator'
    | 'shield'
    | 'armor'
    | 'utility';
  displayName: string;
  description: string;
  tier: number;
  purchaseCost: number;
  resaleRate: number;
  mass: number;
  passivePowerDraw: number;
  compatibilityTags: string[];
  roleTags: string[];
  unlockRequirement?: UnlockRequirement;
  iconKey: string;
}
```

Use a discriminated Zod union for category-specific fields.

## 7.2 Combat definition separation

Weapon ownership data should refer to the current combat definition:

```ts
interface WeaponEquipmentDef extends EquipmentCommon {
  category: 'primaryWeapon' | 'secondaryWeapon';
  weaponDefId: string;
  hardpointClass: string;
  energyCostMultiplier: number;
  upgradeTrackId?: string;
}
```

This keeps projectile patterns and economy metadata independently maintainable.

## 7.3 Upgrade tracks

Use bounded, authored upgrade tracks rather than arbitrary percentage stacking.

```ts
interface EquipmentUpgradeLevel {
  level: number;
  cost: number;
  modifiers: StatModifier[];
  description: string;
}
```

Recommended maximum for Epoch 10: **five levels**. More levels add balance work without proving more functionality.

---

# 8. Derived ship statistics

The runtime player consumes an immutable calculated snapshot, not raw equipment definitions.

```ts
export interface DerivedShipStats {
  maxArmor: number;
  maxShield: number;
  shieldRechargeDelay: number;
  shieldRechargeRate: number;
  shieldRechargeEnergyPerPoint: number;
  maxEnergy: number;
  energyRegenPerSecond: number;
  passivePowerDraw: number;
  maxSpeed: number;
  focusedSpeed: number;
  acceleration: number;
  drag: number;
  totalMass: number;
  maxSupportedMass: number;
  primaryWeapon: RuntimeWeaponSpec;
  secondaryWeapon?: RuntimeWeaponSpec;
  pickupMagnetRadius: number;
}
```

## 8.1 Calculation rules

All calculations must be:

- pure;
- deterministic;
- independent of input iteration order;
- unit-tested;
- shared by Hangar comparisons and Game runtime.

Suggested high-level formulas:

```text
totalMass = hull base mass + sum(equipment mass)
loadRatio = totalMass / hull nominal mass

maxSpeed = propulsion max speed × hull speed factor × massSpeedCurve(loadRatio)
acceleration = propulsion thrust × hull thrust factor / totalMass × tuning constant
focusedSpeed = maxSpeed × propulsion focus ratio

maxArmor = hull base armor + armor module bonus + upgrade modifiers
maxShield = shield capacity × hull shield factor + upgrade modifiers

maxEnergy = generator capacity + hull capacitor bonus
energyRegen = generator regeneration × efficiency modifiers
passivePowerDraw = sum(equipment passive draw)
```

The loadout is invalid when:

```text
totalMass > hull max supported mass
passivePowerDraw > generator supported continuous draw
```

Avoid opaque formulas in UI. The player should see why a configuration is invalid or slower.

---

# 9. Energy system

## 9.1 Runtime behavior

- Primary and secondary weapons consume energy when firing.
- Energy regenerates continuously while below maximum.
- Shields begin recharging only after their damage delay.
- Shield recharge consumes energy.
- When energy is insufficient, shield recharge yields to weapon firing according to a defined priority policy.

## 9.2 Priority policy

Recommended default:

1. passive systems remain powered;
2. player-triggered weapon shot is allowed only if its complete energy cost is available;
3. remaining energy may be used for shield recharge;
4. no partial projectile volley is fired.

This keeps input response predictable.

## 9.3 Energy starvation feedback

The game must communicate starvation with:

- HUD energy bar;
- empty-fire sound with concurrency cap;
- brief weapon icon pulse;
- no repeated error spam every frame.

## 9.4 Frame-rate independence

Energy and shield calculations must use seconds and produce equivalent results at 30, 60, and 120 updates per second within a small tolerance.

---

# 10. Damage model

## 10.1 Layers

```text
Incoming damage
      ↓
Shield absorbs until zero
      ↓
Remaining damage reduces armor/hull
      ↓
Armor reaches zero → player death
```

## 10.2 Shield recharge

- Any shield damage resets recharge delay.
- Recharge begins after the delay if energy is available.
- Recharge stops at maximum.
- Armor does not regenerate during a mission by default.

## 10.3 Invulnerability frames

Current post-hit invulnerability remains, but damage must be applied through a single `ShipDefenseSystem` so shield and armor events are consistent.

## 10.4 Pickups

- shield pickup: restore shield first, then optionally convert overflow to armor or credits according to pickup definition;
- repair pickup: restore armor;
- phase-shield pickup: add temporary nonrecharging shield buffer, if implemented later.

The current pickup called `shield` actually repairs `player.hull`. Rename or migrate it so its behavior matches its name.

---

# 11. Hybrid progression model

## 11.1 Tiers

Recommended campaign tiers:

| Tier | Purpose                                  |
| ---: | ---------------------------------------- |
|    0 | starter equipment, always available      |
|    1 | first meaningful sidegrades              |
|    2 | specialized builds become viable         |
|    3 | strong trade-offs and advanced mechanics |
|    4 | late-game equipment and prestige options |

Tier unlocks come primarily from mission progress, not from spending a threshold of credits.

## 11.2 Sidegrades within tiers

Each major category should normally offer at least three roles per mature tier:

- balanced;
- aggressive/high-output;
- efficient/defensive or mobility-focused.

A new tier may improve baseline efficiency, but should not invalidate every prior specialist item immediately.

## 11.3 Equipment upgrades

Upgrades improve a chosen item through authored steps. They must not eliminate its defining weakness.

Example:

- spread cannon upgrades increase damage and projectile efficiency;
- they do not become as precise as a rail weapon;
- heavy shield upgrades increase capacity;
- they remain heavier/slower to recharge than a rapid shield.

## 11.4 Unlock types

```ts
type UnlockRequirement =
  | { type: 'missionComplete'; missionId: string }
  | { type: 'bossDefeated'; bossId: string }
  | { type: 'campaignTier'; tier: number }
  | { type: 'optionalObjective'; objectiveId: string }
  | { type: 'discovery'; secretId: string };
```

Credits purchase an unlocked item; credits should not bypass every campaign milestone.

---

# 12. Currency system

## 12.1 Currency name

Use **Credits** as the implementation placeholder. The final fiction may rename it later.

## 12.2 Sources of credits

Credits may be earned from:

- enemy destruction;
- ground-target destruction;
- money pickups;
- boss completion reward;
- mission completion reward;
- optional objectives;
- no-death/no-damage/accuracy bonuses;
- difficulty bonus;
- selling equipment.

## 12.3 Enemy and target values

Add a separate `creditValue` field to enemies, bosses, boss parts, and ground targets. Do not derive currency directly from score at runtime.

Score and credits may begin with correlated authored values, but they remain independent fields.

```json
{
  "scoreValue": 400,
  "creditValue": 75
}
```

## 12.4 Money pickups

Money pickups have authored denominations and must be visually distinct from score or equipment pickups.

```ts
interface CreditPickupDef {
  id: string;
  denomination: number;
  magnetizable: boolean;
  lifetime: number;
}
```

A credit-magnet utility may increase attraction radius but may not create credits from nothing.

---

# 13. Mission escrow and banking

## 13.1 Balances

Track three concepts:

```ts
interface CurrencyState {
  bankedCredits: number; // persistent profile balance
  checkpointCredits: number; // protected within current run
  unbankedCredits: number; // earned since last checkpoint
}
```

## 13.2 Recommended policy

- Credits earned during play enter `unbankedCredits`.
- Reaching a checkpoint moves unbanked credits into `checkpointCredits`.
- Dying and retrying from a checkpoint restores the checkpoint snapshot and discards credits earned after it.
- Full mission completion moves checkpoint and unbanked credits into the persistent bank.
- Voluntary quit to menu loses current mission escrow unless the player chooses a clearly labeled save-and-exit feature introduced later.
- Full restart resets mission escrow to the launch snapshot.

This preserves the risk/reward character of mission earnings while respecting the existing checkpoint system.

## 13.3 Anti-duplication requirement

Timeline seek and checkpoint retry can replay enemies. Every reward source must have a stable run-scoped reward ID.

```ts
interface RewardSource {
  rewardId: string;
  amount: number;
}
```

`MissionEconomy` keeps a set of claimed IDs in each checkpoint snapshot. A replayed enemy cannot pay again unless the whole mission is intentionally restarted.

Do not rely only on enemy type ID; multiple enemies of the same type require distinct source IDs.

---

# 14. Mission reward calculation

## 14.1 Reward breakdown

Results must show:

```text
Enemy bounties
Ground-target bounties
Collected money bonuses
Boss reward
Optional objectives
Difficulty bonus
Penalty/lost escrow
----------------------
Total banked this mission
Current bank balance
```

## 14.2 Difficulty

Difficulty may apply a modest completion bonus, for example:

```text
Easy:   1.00×
Normal: 1.10×
Hard:   1.25×
```

Do not make higher difficulty mandatory to afford progression. Higher difficulty should accelerate optional purchases, not unlock the basic campaign path.

## 14.3 Score multiplier interaction

Recommended policy:

- multiplier continues to affect score fully;
- multiplier affects credits only through a small capped mission bonus, if at all;
- raw kill bounty remains stable.

This prevents skilled score play from causing uncontrolled compound economic growth while still acknowledging performance.

---

# 15. Purchases, sales, and refunds

## 15.1 Purchase transaction

A purchase succeeds only if:

- item is unlocked;
- player has sufficient banked credits;
- item is not already owned unless duplicates are allowed;
- resulting mutation validates.

```ts
interface EconomyResult {
  success: boolean;
  error?: EconomyError;
  transaction?: CreditTransaction;
}
```

## 15.2 Resale policy

Recommended hybrid policy:

- **100% refund** for purchases reversed before leaving the current Hangar session;
- **75% resale value** after the item has been taken into a mission;
- upgrades follow the same rule;
- starter equipment may have zero sale value if selling it would leave the player stranded.

This combines experimentation-friendly behavior with meaningful long-term choices.

## 15.3 Selling equipped equipment

Choose one of these safe behaviors:

1. block the sale and explain that the item is equipped; or
2. atomically equip a legal owned fallback, then sell.

Never leave an invalid loadout persisted.

## 15.4 Currency safety

- integer credits only;
- no negative balances;
- use safe integer validation;
- no floating-point prices;
- transaction IDs prevent duplicate mission settlement.

---

# 16. Credit ledger

Use an explicit ledger for debugging and exploit prevention.

```ts
export interface CreditTransaction {
  id: string;
  runId?: string;
  missionId?: string;
  timestamp: number;
  amount: number;
  reason:
    | 'enemyReward'
    | 'groundReward'
    | 'pickupReward'
    | 'missionReward'
    | 'objectiveBonus'
    | 'difficultyBonus'
    | 'purchase'
    | 'sale'
    | 'refund'
    | 'migrationGrant'
    | 'debugGrant';
  sourceId?: string;
  balanceAfter: number;
}
```

Persist a bounded recent ledger or campaign summary rather than every combat transaction forever. Mission runtime may keep a detailed temporary ledger and collapse it into a settlement transaction at completion.

---

# 17. Inventory model

Because Epoch 10 does not include random item affixes or durability, equipment does not need unique object instances.

```ts
interface OwnedEquipmentState {
  equipmentId: string;
  upgradeLevel: number;
  acquiredAtCampaignStep: number;
  usedInMission: boolean;
}

interface InventoryState {
  owned: Record<string, OwnedEquipmentState>;
}
```

If duplicate consumables are later added, store those quantities separately.

---

# 18. Save profile v2

## 18.1 Recommended separation

```ts
interface SaveRootV2 {
  version: 2;
  settings: SettingsV2;
  records: PlayerRecords;
  profile: CampaignProfile;
}
```

```ts
interface CampaignProfile {
  profileId: string;
  bankedCredits: number;
  campaignTier: number;
  completedMissions: string[];
  unlockedEquipment: string[];
  inventory: InventoryState;
  loadouts: ShipLoadout[];
  activeLoadoutId: string;
  missionRecords: Record<string, MissionRecord>;
}
```

## 18.2 Migration from v1

Migration must:

- preserve volume, accessibility, touch, difficulty, and records;
- create a campaign profile;
- grant starter credits if required;
- grant all starter equipment;
- create a legal starter loadout;
- never infer ownership from the old temporary weapon pickup state;
- be idempotent.

## 18.3 Runtime validation

Validate localStorage data with Zod. Unknown fields may be stripped. Invalid fields fall back individually where safe; an invalid profile that cannot be repaired falls back to a new starter profile while preserving valid settings if possible.

---

# 19. Services and ownership boundaries

Recommended modules:

```text
src/game/equipment/
  EquipmentRegistry.ts
  LoadoutValidator.ts
  ShipStatCalculator.ts
  RuntimeLoadoutSnapshot.ts

src/game/economy/
  EconomyService.ts
  MissionEconomy.ts
  CreditLedger.ts
  RewardResolver.ts

src/game/profile/
  ProfileRepository.ts
  SaveMigration.ts
  ProgressionService.ts

src/game/player/
  ShipEnergySystem.ts
  ShipDefenseSystem.ts
  PlayerShipController.ts
```

## 19.1 EquipmentRegistry

Loads and validates authored equipment definitions and cross-references combat weapon definitions.

## 19.2 LoadoutValidator

Returns structured validation errors. It does not mutate inventory or loadout.

```ts
type LoadoutErrorCode =
  | 'NOT_OWNED'
  | 'NOT_UNLOCKED'
  | 'INCOMPATIBLE_SLOT'
  | 'MASS_EXCEEDED'
  | 'POWER_EXCEEDED'
  | 'MISSING_REQUIRED_SLOT'
  | 'UTILITY_SLOT_EXCEEDED'
  | 'DUPLICATE_UNIQUE_ITEM';
```

## 19.3 ShipStatCalculator

Pure function used by Hangar, gameplay, tests, and telemetry.

## 19.4 EconomyService

Owns banked-credit purchases, sales, refunds, and upgrades.

## 19.5 MissionEconomy

Owns run escrow, checkpoint snapshots, claimed reward IDs, and mission settlement.

## 19.6 PlayerShipController

Consumes a `RuntimeLoadoutSnapshot`. It must not read mutable profile data every frame.

---

# 20. Runtime integration with current Skyforge systems

## 20.1 Player

Replace direct dependency on static `PLAYER` values with a runtime configuration object:

```ts
new Player(scene, derivedStats);
```

Do not let equipment definitions directly mutate Phaser body values throughout the code.

## 20.2 WeaponSystem

Extend the current system to accept runtime weapon specs containing:

- combat weapon definition;
- upgrade level;
- energy cost;
- equipment modifiers;
- target-domain rules.

The weapon system requests energy from `ShipEnergySystem` before spawning a complete volley.

## 20.3 Pickups

Add `credits` and `armorRepair` effects. Clarify the current `shield` pickup, which presently increases hull.

Persistent campaign mode behavior:

- weapon-upgrade pickup: temporary mission power level;
- weapon-swap pickup: temporary field weapon or disabled by campaign rules;
- credit pickup: mission escrow;
- shield pickup: shield restore;
- repair pickup: armor restore;
- equipment crate: rare persistent unlock, deferred unless needed.

## 20.4 Enemy and ground rewards

Add stable reward IDs at spawn time. Formation member identity should include level event, formation instance, and member index.

Example:

```text
level_01:event_07:pinch_attack:instance_0:member_3
```

## 20.5 Checkpoints

A checkpoint snapshot must contain:

- level time;
- loadout runtime state policy;
- weapon temporary upgrade state;
- mission credits protected at checkpoint;
- claimed reward IDs;
- score policy;
- deaths and telemetry continuity policy.

The snapshot must be explicit and serializable for tests.

---

# 21. Hangar and shop UX

## 21.1 Required screens

A single functional HangarScene may contain:

- current ship preview placeholder;
- equipment category tabs;
- owned/available item list;
- item description;
- current versus candidate comparison;
- credits;
- mass and power budgets;
- equip/buy/sell/upgrade actions;
- launch button;
- validation panel.

## 21.2 Comparison display

```text
                     CURRENT       CANDIDATE
Armor                  120             90   ▼30
Shield                  80            140   ▲60
Shield recharge        8/s            4/s   ▼4
Energy                 100            130   ▲30
Energy regen           18/s           13/s  ▼5
Max speed              260            290   ▲30
Acceleration           520            610   ▲90
Mass                  18/24          21/24
Passive power         11/20          17/20
```

Show both benefits and drawbacks. Invalid candidates must show the exact reason.

## 21.3 Controls

Hangar must support:

- keyboard;
- gamepad;
- pointer;
- touch at a usable minimum size.

It should use the same menu input abstraction created during Epoch 9R.

## 21.4 Launch validation

Launch is disabled when the loadout is invalid. The UI must never silently repair a deliberate user configuration at launch time. A separate “Restore starter loadout” command may be provided.

---

# 22. Starter equipment package

Provide a guaranteed legal starter set:

- balanced starter hull;
- pulse cannon;
- basic missile system;
- basic propulsion;
- basic generator;
- basic rechargeable shield;
- light armor or no armor module;
- no required utility.

The starter loadout must remain capable of completing Level 01 on Normal difficulty after tuning.

---

# 23. Initial sidegrade content target

Epoch 10 does not need a huge catalog. A good mechanical proof is:

| Category         | Minimum distinct items |
| ---------------- | ---------------------: |
| Hull             |                      3 |
| Primary weapon   |     3 existing/adapted |
| Secondary weapon |                      2 |
| Propulsion       |                      3 |
| Generator        |                      3 |
| Shield           |                      3 |
| Armor            |                      2 |
| Utility          |                      2 |

This is enough to prove trade-offs without overwhelming balancing work.

---

# 24. Economy balancing targets

Initial tuning goals:

- one successful mission should usually enable one meaningful purchase or upgrade;
- the player should not be able to buy every item immediately;
- a normal first campaign completion should fund roughly 60–80% of the catalog, depending on optional objectives;
- no mandatory mission should require a single specific purchased item;
- starter gear plus reasonable upgrades remains viable;
- replay permits completionists to acquire everything;
- selling and experimenting should not create a permanent progression trap.

Use telemetry rather than guessing:

- credits earned per mission;
- bank balance before/after mission;
- purchase sequence;
- equipped item usage time;
- failed launch-validation reasons;
- deaths by loadout;
- damage dealt and received by equipment combination;
- unspent-credit distribution.

---

# 25. Exploit prevention

Test these cases explicitly:

1. Kill an enemy, reach checkpoint, die, retry, and kill it again.
2. Seek backward in editor/debug mode and replay a reward source.
3. Complete mission, refresh Results, and attempt settlement again.
4. Double-click Buy.
5. Buy while the balance changes in the same frame.
6. Sell an item used by multiple saved loadouts.
7. Import/tamper with a save containing negative credits or unowned equipment.
8. Start a mission while inventory and active loadout disagree.
9. Quit after collecting credits but before checkpoint.
10. Restart the entire mission after banking a previous completion.

Every transaction and settlement must be idempotent where appropriate.

---

# 26. Testing requirements

## 26.1 Unit tests

- each equipment schema;
- cross-reference validation;
- loadout errors;
- stat calculation fixtures;
- calculation order independence;
- energy depletion/recharge;
- shield recharge delay and energy cost;
- purchase/sale/refund atomicity;
- save v1 → v2 migration;
- mission escrow and checkpoint rollback;
- duplicate reward prevention;
- progression unlock conditions.

## 26.2 Integration tests

- build player from active loadout;
- fire until energy depletion and recover;
- damage shield then armor;
- checkpoint and retry with correct escrow;
- finish mission and settle once;
- Hangar purchase/equip/save/reload/launch;
- sell equipped item safely;
- Results returns to Hangar with updated balance.

## 26.3 E2E tests

- new profile → starter Hangar → launch;
- earn credits → complete mission → purchase item;
- equip item → launch again → runtime stats changed;
- hard refresh preserves profile;
- gamepad can navigate Hangar and launch;
- invalid loadout blocks launch with visible reason.

---

# 27. Telemetry additions

```ts
interface EconomyTelemetry {
  startingBank: number;
  missionCreditsEarned: number;
  checkpointCredits: number;
  creditsLost: number;
  completionBonus: number;
  endingBank: number;
  transactions: EconomyTelemetryTransaction[];
}

interface LoadoutTelemetry {
  loadoutId: string;
  equipmentIds: string[];
  derivedStatsHash: string;
  weaponUsageSeconds: Record<string, number>;
  energyStarvedSeconds: number;
  shieldDowntimeSeconds: number;
}
```

Do not transmit externally. Export remains local during development.

---

# 28. Epoch 10 sprint plan

## 10.1 — Schemas, registry, and save v2

**Deliverables**

- equipment schemas and definitions;
- content registry maps and reference checks;
- profile/save v2 schemas;
- v1 migration;
- starter package.

**Acceptance**

- all content validates;
- v1 migration is tested and idempotent;
- starter profile has a legal loadout.

## 10.2 — Loadout validation and stat calculation

**Deliverables**

- pure validator;
- pure stat calculator;
- structured comparisons;
- test fixtures for all archetypes.

**Acceptance**

- invalid combinations produce exact error codes;
- calculations are deterministic and order-independent.

## 10.3 — Economy and mission escrow

**Deliverables**

- banked credits;
- credit ledger;
- purchases/sales/refunds;
- enemy/ground credit values;
- credit pickups;
- checkpoint snapshots and claimed reward IDs.

**Acceptance**

- no double rewards after retry/seek;
- failed transactions leave state unchanged.

## 10.4 — Runtime ship systems

**Deliverables**

- runtime loadout snapshot;
- propulsion-derived movement;
- energy system;
- shield/armor defense;
- weapon energy integration;
- updated HUD.

**Acceptance**

- three distinct builds feel and measure differently;
- frame-rate-independent tests pass.

## 10.5 — Functional Hangar/Shop

**Deliverables**

- browse/buy/sell/equip/upgrade;
- comparison panel;
- validation and launch;
- keyboard/gamepad/pointer/touch navigation.

**Acceptance**

- complete purchase/equip/launch loop without developer tools.

## 10.6 — Progression and full-flow verification

**Deliverables**

- tier unlocks;
- mission settlement/results breakdown;
- Results → Hangar flow;
- telemetry;
- E2E and exploit tests;
- balance report.

**Acceptance**

- full campaign-loop slice is stable and persisted.

---

# 29. Explicit non-goals for Epoch 10

- final pixel-art inventory icons;
- animated hangar background;
- random loot rarity or affixes;
- equipment durability;
- repair bills;
- crafting;
- online economy;
- cloud save;
- real-money purchases;
- player-to-player trading;
- geospatial or procedural Level Composer work;
- large campaign content expansion;
- exact recreation of Tyrian or Raptor items.

---

# 30. Definition of done

This addendum is complete when:

- currency can be earned, protected at checkpoints, lost according to policy, settled, and spent;
- equipment can be bought, sold, upgraded, equipped, validated, saved, and reloaded;
- the ship’s movement, energy, shielding, armor, and weapons are derived from the active loadout;
- at least three materially different legal builds exist;
- no reward duplication or partial transaction is reproducible;
- the full Title → Hangar → Mission → Results → Hangar loop works with keyboard and gamepad;
- existing level, boss, editor, and content systems continue to pass validation and tests;
- placeholder visuals remain sufficient, allowing final assets to be added later without changing the mechanics contract.

# 31. Epoch 16 package governance

Equipment, economy, progression, reward, and derived-stat definitions remain part of the versioned Tuning Pack and now participate in the locked collaboration workflow.

Each approved campaign build pins the exact Tuning Pack semantic version, content revision, and fingerprint in a `.sflock`. Deterministic change reports and JSON-path review comments allow collaborators to inspect economy and loadout adjustments independently of level artwork or music changes. Open blocking comments prevent production compilation.

Git folder mode stores stable equipment and progression definitions as separate files while preserving authored order through the package index. The production compiler validates references but does not reinterpret costs, refund policy, power budgets, navigation envelopes, or settlement rules. Those values remain controlled by the approved Tuning Pack.
