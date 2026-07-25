# SkyForge Epoch 18.2 — Deficiency Log

## Severity summary

- Critical: **0**
- High: **0**
- Medium: **3**
- Low: **4**

## Corrected release blockers

- **Inner-corner legibility:** corrected with broad supersampled concave geometry and explicit radius/non-linearity tests.
- **Diagonal shoreline geometry:** corrected with four true full-tile 45-degree masks and sustained playable diagonal sequences.
- **Internal shoreline seams:** corrected by deriving cliff and lip effects only from exposed contours.

## Remaining medium findings

### M-01 — Real-browser visual regression remains uncertified

The release has deterministic rendered evidence and pixel-level asset tests, but Chromium/WebKit screenshots should still be captured in a provisioned CI environment.

### M-02 — Studio autotile metadata exposes one primary frame per mask

The runtime selects from four deterministic variants, while generic Studio metadata exposes a primary mask-to-frame mapping. Variant-pool editing remains future authoring work.

### M-03 — Environmental landmarks remain visual-only

Stations, docks, bridges, ruins, and platforms are not yet destructible targets or encounter anchors.

## Remaining low findings

- The player and enemy sprites remain placeholders, limiting final shadow and scene fidelity.
- One canyon biome cannot demonstrate campaign-wide environmental variety.
- Decoration placement is deterministic rather than fully hand-authored cell by cell.
- Larger source textures increase art-resource size, although current release budgets pass.
