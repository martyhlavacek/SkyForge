# Epoch 17.9 Deficiency Log

**Release:** 0.9.1  
**Date:** 2026-07-14

No Critical or High-severity defects were found by the executable release gate.

## Medium

### D-17.9-01 — Browser gameplay certification is incomplete

**Status:** Open  
**Cause:** Playwright Chromium is not installed in the audit environment.  
**Risk:** Automated tests cannot prove WebGL sampling, camera scaling, or full-scene visual composition on a real browser.  
**Action:** Run the desktop Chromium and WebKit projects in CI after installing their pinned Playwright binaries.

### D-17.9-02 — Blob-47 art is procedurally derived rather than hand-authored

**Status:** Open  
**Risk:** All 47 masks are topologically valid, but some rare one-cell projections or inner corners may still look mechanical compared with a hand-painted commercial tileset.  
**Action:** Use the Blob-47 diagnostic map to art-direct individual masks without changing the runtime mapping contract.

### D-17.9-03 — Water is continuous but remains stylistically provisional

**Status:** Open  
**Risk:** The 128×128 animated plane removes the 32-pixel grid, but the wave direction and palette still need comparison against the final art direction and desired gameplay readability.  
**Action:** Replace the two plane frames through the Asset Studio while preserving exact edge continuity and synchronized animation.

### D-17.9-04 — Terrain autotile updates still regenerate broader areas than necessary

**Status:** Open  
**Risk:** Editing very large maps may perform avoidable recalculation.  
**Action:** Restrict Blob-47 regeneration to the edited cell and its eight-neighbour region, with dirty-chunk invalidation.

## Low

### D-17.9-05 — Sandstone metatile cadence can become visible over very long uninterrupted land fields

**Status:** Open  
**Risk:** The cadence is now 128 pixels rather than 32 pixels, but large uniform areas may eventually reveal the 4×4 pattern.  
**Action:** Add two or three compatible metatile variants selected by deterministic macro-chunk hashing.

### D-17.9-06 — Shadow is not yet altitude-responsive

**Status:** Open  
**Risk:** The shadow improves separation but uses one fixed offset and scale.  
**Action:** Later expose altitude as a presentation parameter that affects offset, blur/opacity, and scale for player and enemy aircraft.

### D-17.9-07 — Dormant terrain-collision schemas remain in compatibility data

**Status:** Accepted  
**Risk:** They add conceptual weight although runtime collision is disabled.  
**Action:** Retain until the terrain-navigation mechanic is formally redesigned or the package schema receives a breaking-version migration.
