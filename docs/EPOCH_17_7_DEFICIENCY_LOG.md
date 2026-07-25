# Epoch 17.7 Deficiency Log

## Severity summary

- Critical: 0
- High: 0
- Medium: 4
- Low: 2

## Medium findings

### M-01 — Browser suite is not certified in the audit environment

**Evidence:** system Chromium returns `ERR_BLOCKED_BY_ADMINISTRATOR` for loopback navigation. WebKit was not executed.

**Risk:** automated tests cannot prove canvas rendering, input and layout behavior in real Chromium/WebKit here.

**Action:** require the existing Playwright matrix in CI and run the package locally before accepting visual release quality.

### M-02 — Level map representation is larger than necessary

The full-width river is represented as 13,600 explicit cells. This increases `canyon_passage.json` from about 0.79 MB to about 1.92 MB and raises the bundled content chunk to 617 KB.

**Risk:** slower editor import/serialization and unnecessary bundle growth as more long levels are added.

**Action:** add a schema-supported repeated/fill layer or chunk-RLE encoding. Keep sparse override cells for authored variations. This should recover most of the 312 KB raw-JavaScript increase without changing the result.

### M-03 — Cardinal-16 does not model diagonal topology

The new system correctly handles N/E/S/W continuity, but it cannot distinguish diagonal corners or produce Blob-47-style inner-corner combinations.

**Risk:** complex islands, narrow diagonal cuts and some one-tile turns may still look square or stepped.

**Action:** retain Cardinal-16 for broad canyon walls, then add a gated 8-neighbour/Blob-47 family only for materials whose art set supports it.

### M-04 — Retired collision data remains in the package architecture

Collision schemas, corridor guides, terrain-state event support and generic object-state snapshots remain for compatibility and future reconsideration, although the active runtime and Studio tool no longer use collision.

**Risk:** maintainers may mistake dormant data for active gameplay behavior; it adds conceptual and test surface.

**Action:** mark these types as dormant in user-facing UI and documentation. At the next package-schema major version, decide either to restore the mechanic behind an explicit feature flag or remove the data family fully.

## Low findings

### L-01 — Connected masks need a final art-direction pass

The output is coherent and no longer randomly stamped, but the water has an obvious 32-pixel texture cadence and the cliff family has limited variation per adjacency state.

**Action:** add phase-safe water variants, larger macro-detail overlays and two or three interchangeable art variants for common masks without altering logical adjacency.

### L-02 — Autotile regeneration is whole-layer rather than dirty-region based

The editor recomputes the complete surface and rim layers after autotiling.

**Risk:** acceptable for the current 800-row level, but inefficient for larger maps and rapid repeated edits.

**Action:** recalculate the changed cells plus their one-cell neighbourhood and update only affected rim cells.

## Prioritized next work

1. Local/CI browser and gameplay review of Epoch 17.7.
2. Compact fill/RLE map representation.
3. Water and common-edge variation pass.
4. Dirty-region autotiling.
5. Only then reconsider collision semantics and fairness as a separate design milestone.
