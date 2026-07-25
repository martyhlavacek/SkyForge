# Skyforge Epoch 10 Implementation Report

**Implementation date:** 2026-07-12  
**Status:** Complete mechanical vertical slice; physical-device/browser QA remains external

## 1. Delivered campaign loop

Epoch 10 implements the complete mechanical loop:

```text
Title → Hangar → Launch → Mission → Checkpoint escrow → Boss settlement → Results → Hangar
```

The implementation deliberately uses placeholder presentation so final pixel-art assets can be added without changing economy or combat contracts.

## 2. Persistent campaign profile and save migration

The save format is now version 2 and contains:

- persistent integer credits;
- campaign tier and completed missions;
- unlocked and owned equipment;
- bounded equipment upgrade levels;
- saved ship loadouts and active-loadout ID;
- mission records;
- processed settlement IDs;
- a bounded transaction ledger;
- all Epoch 9 settings and record fields.

Legacy v1 saves migrate automatically. Invalid fields are sanitized independently, and an invalid campaign profile falls back to a legal starter profile.

## 3. Equipment content

Twenty-one validated equipment definitions are included:

- 3 hulls;
- 3 primary weapons;
- 2 secondary weapons;
- 3 propulsion systems;
- 3 generators;
- 3 shields;
- 2 armor packages;
- 2 utilities.

Equipment content is loaded through `ContentRegistry`, checked against schemas, and cross-referenced against combat weapon, mission, and boss definitions.

## 4. Loadout and derived statistics

`LoadoutValidator` checks:

- known IDs and correct categories;
- ownership and unlock state;
- hull hardpoint and size compatibility;
- utility-slot count;
- unique-item duplication;
- total equipment mass;
- passive generator load.

`ShipStatCalculator` produces one deterministic runtime snapshot containing:

- armor and shield capacity;
- shield delay, rate, and energy cost;
- generator capacity and regeneration;
- propulsion speed, focused speed, acceleration, and drag;
- weapon energy, damage, and fire-rate modifiers;
- pickup magnet radius;
- collision radius and minimum-corridor contract for Epoch 11 terrain;
- stable stat hash.

The Phaser player consumes this immutable snapshot rather than mutable shop definitions.

## 5. Runtime ship systems

The player now uses:

- `ShipEnergySystem` for frame-rate-independent spending and regeneration;
- `ShipDefenseSystem` for shield-first damage, delayed shield recharge, armor repair, and energy-coupled recharge;
- loadout-derived movement;
- energy-gated primary and secondary volleys;
- updated armor, shield, energy, weapon, missile, score, and mission-credit HUD.

Temporary in-mission weapon pickups remain temporary and do not overwrite persistent owned equipment.

## 6. Economy and mission escrow

Credits are independent from score. Authored rewards now exist on:

- enemies;
- ground targets;
- boss bodies and destructible parts;
- credit pickups;
- mission completion;
- difficulty settlement bonuses.

`MissionEconomy` separates:

- protected checkpoint credits;
- at-risk post-checkpoint credits;
- claimed reward IDs;
- category breakdowns;
- final persistent settlement.

Checkpoint retries restore reward sequence, claimed IDs, escrow, and drop-RNG state. This makes reward replay deterministic and blocks duplicate awards. Full mission completion is idempotent through processed settlement IDs.

## 7. Hangar and transactions

The functional Hangar supports:

- category browsing;
- current ownership, unlock, and equipped states;
- candidate-vs-current stat comparison;
- purchasing;
- equipping;
- bounded upgrades;
- full refunds for unused purchases;
- resale after mission use;
- insufficient-credit and compatibility errors;
- launch validation;
- keyboard, pointer, and gamepad navigation.

Development builds provide `G` in the Hangar to grant 10,000 credits and unlock all equipment for rapid testing. This shortcut is gated by the debug registry flag.

## 8. Progression and results

Completing `level_01`:

- settles mission rewards exactly once;
- updates mission records;
- advances campaign tier to 1;
- unlocks tier-one equipment;
- displays an itemized payout;
- returns the player to the Hangar.

Failed missions do not persist at-risk mission credits. The Game Over scene supports checkpoint retry, full restart, or abandonment to the Hangar.

## 9. Audio integration

Epoch 10 adds distinct procedural feedback for:

- pitched credit pickup chains;
- purchase success;
- equipment upgrades;
- invalid/insufficient-funds actions;
- equipment unlocks.

The existing adaptive mission score remains integrated through the shared Web Audio owner.

## 10. Test coverage

The suite now covers:

- all 21 equipment JSON files;
- schema and content cross-validation;
- starter-loadout legality;
- compatibility and utility-slot errors;
- deterministic stat calculation and upgrades;
- energy spending and frame-rate independence;
- shield/armor/recharge behavior;
- atomic purchases, refunds, equip failures, and ledgers;
- reward idempotency;
- checkpoint escrow rollback;
- one-time settlement and progression;
- save v1 → v2 migration;
- deterministic reward-sequence and RNG rollback.

See `VERIFICATION_REPORT.md` for command results.

## 11. Known limitations and deferrals

- Final hangar art and equipment icons are placeholders.
- Only one campaign mission exists, so progression currently proves tier 0 → tier 1.
- Utility selection uses the first slot in the current Hangar UI; multi-slot slot targeting should be expanded with final UI work.
- Repair deductions, crafting, durability, random item affixes, and ammunition purchasing remain non-goals.
- Physical iPhone and controller QA must be performed outside this sandbox.
- Playwright requires the Chromium binary installed by CI or the tester.
- `GameScene` remains large and should be decomposed as terrain runtime is introduced.

## 12. Tester path

```sh
npm ci
npm run dev
```

Then:

1. Open the shown local URL.
2. Press Enter on **Hangar / Start**.
3. In development mode, press `G` to unlock all equipment and grant testing credits.
4. Browse categories with Left/Right and items with Up/Down.
5. Press Enter to buy or equip, `U` to upgrade, and `X` to sell.
6. Press `L` or select **Launch**.
7. Complete the mission and inspect settlement on the Results screen.

For normal progression testing, do not use the debug grant.
