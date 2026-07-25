# SkyForge Epoch 18.2 — Blob-47 Geometry Correction

## Purpose

Epoch 18.2 corrects the two deficiencies identified after Epoch 18.1: inner corners were too small to read during gameplay, and diagonal adjacency existed in data without producing convincing diagonal shoreline geometry.

## Rendering changes

- Replaced the previous small-notch quarter templates with a supersampled scalar-field Blob-47 construction.
- Missing diagonals now create broad concave cuts with an 8–9 pixel gameplay-scale radius.
- The four fully supported convex corner states now render as true 45-degree banks spanning the entire 32×32 tile.
- Shoreline lips, cliff faces, shallow-water fringes, and shadows are generated only from the genuinely exposed contour. Connected tile borders no longer receive internal cliff bands.
- Four deterministic visual variants remain available for every one of the 47 canonical masks.

## Level changes

The opening and a mid-level verification section now include compact one-cell-per-row transitions. This is the correct cadence for continuous 45-degree Blob-47 banks; slower ramps would alternate straight and corner cells and read as a sawtooth.

The opening contains:

- sustained left- and right-bank diagonals;
- both ascending and descending directions;
- broad reversals and inner bays;
- all four convex diagonal masks;
- all four fully surrounded single-missing-diagonal inner-corner masks.

## Acceptance gates

The release fails unless:

- every supported diagonal-bit pair changes at least 60 gameplay-scale pixels;
- every diagonal tile spans the full 32-pixel tile at a slope within 5% of 45 degrees;
- diagonal edge regression has R² ≥ 0.99;
- each inner corner has at least an 8×8 curved extent;
- each inner corner is measurably non-linear;
- the playable opening contains at least four sustained diagonal runs on each bank;
- both diagonal directions appear on both banks;
- every required diagonal and inner-corner orientation appears at least four times in the opening.

Evidence is recorded in `EPOCH_18_2_BLOB47_GEOMETRY_TEST.json` and `EPOCH_18_2_BLOB47_GEOMETRY_EVIDENCE.png`.
