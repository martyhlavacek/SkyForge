# SkyForge Epoch 18.1 — Deficiency Log

## Severity summary

- Critical: **0**
- High: **0**
- Medium: **3**
- Low: **4**

## Medium findings

### M-01 — Browser visual regression remains uncertified

The source includes Playwright scenarios, but the audit environment does not provide the pinned Chromium/WebKit binaries. Static preview rendering, texture analysis, unit/component tests, and production builds pass, but a real-browser screenshot comparison remains an external release gate.

**Recommendation:** install pinned browsers in CI, capture fixed mission-distance screenshots, and compare them against approved visual baselines with a controlled tolerance.

### M-02 — Studio autotile metadata exposes one primary frame per mask

The runtime chooses deterministically among four visual variants for each Blob-47 mask. The generic Asset Studio tileset schema still stores one mask-to-frame mapping, while all variants appear as individual tile entries.

**Recommendation:** extend the authoring schema to support variant pools directly so designers can inspect and override runtime variation without editing package data.

### M-03 — Environmental landmarks are visual-only

Stations, docks, bridges, ruins, and outposts improve level identity but do not yet participate as destructible targets, encounter anchors, or scoring objectives.

**Recommendation:** promote selected landmarks into a separate ground-target/set-piece system after the collision and terrain-interaction design is reconsidered.

## Low findings

### L-01 — Placeholder aircraft limits final shadow fidelity

The shadow correctly follows a triangular placeholder player ship. It should be regenerated from the eventual production sprite silhouette.

### L-02 — One biome cannot demonstrate long-form campaign variety

The canyon now has strong internal beats, but Tyrian and Raptor establish identity through multiple strongly differentiated environments. Additional biome sets remain future work.

### L-03 — Decoration placement is deterministic but not designer-authored cell by cell

The generator uses authored zones and deterministic placement rules. A later pass could allow designers to pin, exclude, or replace individual decorations in Level Studio.

### L-04 — Terrain source files are larger

The 512-pixel water and sandstone sources and four Blob variants improve concealment but increase art-resource size. Current build budgets pass, though lower-memory device profiling remains advisable.
