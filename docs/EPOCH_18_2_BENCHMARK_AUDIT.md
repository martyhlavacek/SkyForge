# SkyForge Epoch 18.2 — Benchmark Audit

**Application version:** 0.10.2  
**Required internal average:** 8.50 / 10  
**Final internal average:** **8.70 / 10**

Epoch 18.2 supersedes the Epoch 18.1 score. Epoch 18.1 did not adequately test whether inner curves and diagonal masks were visually legible; that candidate is rejected against the requested standard.

The final score is a manual art-direction assessment of the final gameplay-scale preview and complete mask sheet, supported by automated geometry, texture, map, build, and package gates. It is not an independent external review.

| Category | Score |
|---|---:|
| Blob-47 topology and transitions | **8.8** |
| Water continuity and naturalism | **8.7** |
| Sandstone continuity and variation | **8.5** |
| Shoreline silhouette and depth | **8.6** |
| Macro landform composition | **8.7** |
| Landmark and set-dressing density | **8.6** |
| Benchmark-inspired visual hierarchy | **8.6** |
| Tile and metatile concealment | **8.8** |
| Gameplay readability and palette | **9.2** |
| Altitude and player shadow | **8.5** |
| **Average** | **8.70** |

## Geometry evidence

- 52 supported diagonal-bit comparisons tested.
- Minimum changed area: 64 gameplay-scale pixels.
- Minimum mean alpha difference: 14.484.
- Four diagonal masks span the complete tile at ±1.0 slope with R² = 1.0.
- Four inner-corner masks have 8×8 curved extents and non-linear edge regression.
- The first 140 rows contain sustained diagonals in both directions on both banks.
- The opening contains all four diagonal and all four inner-corner orientations at least four times.

The machine-readable audit is in `EPOCH_18_2_BENCHMARK_AUDIT.json`; the manually reviewed category values and method are in `EPOCH_18_2_MANUAL_RUBRIC.json`.
