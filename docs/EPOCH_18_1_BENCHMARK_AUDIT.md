# SkyForge Epoch 18.1 — Artwork and Blob-47 Benchmark Audit

**Release:** Epoch 18.1  
**Application version:** 0.10.1  
**Required score:** 8.50 / 10  
**Final score:** **8.76 / 10 — PASS**

## Scope and method

This is a structured internal art-direction audit, not an independent external review. The comparison focuses on the terrain qualities relevant to the first canyon level:

- *Raptor: Call of the Shadows*: restrained water, readable macro landforms, canals, detailed platforms, fields, installations, city/industrial landmarks, and strong aircraft-to-ground separation.
- *Tyrian*: rich environmental variation, layered detail, unusual organic/mechanical decoration, strong colour identity, and optional moving ground shadows.
- *Major Stryker*: bold gameplay readability, clear shoreline changes, water-zone set pieces, waterfalls, tunnels, and interconnected ground structures.

The audit combines direct visual comparison with measurable release gates. Intermediate candidates remained private. The first candidate did not meet the requested standard; water scale, sandstone scale, Blob-47 variation, shoreline treatment, geological composition, environmental density, landmark cadence, and package metadata were revised before the final score was accepted.

## Final rubric

| Category | Score | Final assessment |
|---|---:|---|
| Blob-47 topology and transitions | **9.3** | All 47 canonical masks are present. Each boundary and shoreline state has four deterministic visual variants. Curves, concave bays, peninsulas, channels, and four substantial islands are represented without fragile one-cell caps. |
| Water continuity and naturalism | **8.7** | Three exactly seamless 512×512 frames form one continuous plane. Directional gradient energy is balanced, contrast is restrained, and there are no explicit water cells or 32-pixel borders. |
| Sandstone continuity and variation | **8.5** | A seamless 512×512 source is sampled in world space beneath the masks. It passes one-tile and 128-pixel repetition limits and is broken up by erosion and props. |
| Shoreline silhouette and depth | **8.6** | The shoreline is separated from land fill, uses a consistent lip/undercut hierarchy, and no longer repeats cave-like cavities as a core transition motif. |
| Macro landform composition | **8.7** | The canyon has a four-column centre range, water widths from six to thirteen cells, broad bends, controlled pinches, basins, peninsulas, and four islands sized 91–160 cells. |
| Landmark and set-dressing density | **8.6** | 195 landmark cells plus sediment, rocks, cracks, and scrub create recurring visual beats. Landmark spacing is capped at 80 rows, with stations, docks, bridges, ruins, and outposts beginning near the start. |
| Benchmark-inspired visual hierarchy | **8.6** | Quiet water supports rather than dominates action; landforms remain readable; industrial landmarks and natural dressing create a Raptor/Tyrian hybrid while retaining Major Stryker-like palette separation. |
| Tile and metatile concealment | **8.9** | Water uses a continuous plane, sandstone uses a 512-pixel source, Blob-47 mappings select among four variants, and the runtime no longer exposes a regular 32-pixel grid during normal play. |
| Gameplay readability and palette | **9.2** | Water and sandstone have approximately 44 luminance points of separation. Player, bullets, enemies, shoreline, and structures remain distinguishable at gameplay scale. |
| Altitude and player shadow | **8.5** | A dedicated layered ship-shaped shadow follows visibility, movement, invulnerability blinking, and death while remaining offset beneath the aircraft. |

**Average: 8.76 / 10**

## Objective evidence

The machine-readable evidence is in `EPOCH_18_1_BENCHMARK_AUDIT.json`. The release gate verifies:

- 47 canonical Blob-47 masks;
- four boundary variants and four shoreline variants per mask;
- zero explicit water cells;
- three 512×512 exactly wrapped water frames;
- water directional-gradient ratio no greater than 1.12;
- restrained water contrast and nontrivial 32-pixel shift differences;
- one 512×512 exactly wrapped sandstone source;
- sandstone variation at 32- and 128-pixel shifts;
- four islands, each at least 80 occupied cells;
- centreline and channel-width variation;
- 195 landmark cells with a maximum 80-row gap;
- independent sediment, rock, crack, scrub, ruin, and platform layers;
- sufficient water/land luminance separation;
- a dedicated layered player-shadow texture and runtime lifecycle.

## Acceptance decision

Epoch 18.1 clears the requested 8.5 threshold. The result now reads as an authored DOS-era vertical-shooter environment rather than a Blob-47 stress test. The remaining gaps are refinement opportunities rather than release blockers: enemy/player sprite art remains placeholder, landmarks are not yet interactive ground targets, and browser screenshot automation still needs a fully provisioned CI browser environment.
