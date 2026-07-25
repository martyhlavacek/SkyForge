# Epoch 18 QA Audit

## Automated release gates

| Gate | Result |
|---|---|
| Portable npm lockfile | Passed |
| ESLint | Passed |
| TypeScript strict check | Passed |
| Texture and topology verifier | Passed |
| Vitest | 375 tests across 55 files passed |
| Source import cycles | 0 |
| Root production build | Passed |
| `/skyforge/` deployment build | Passed |
| Bundle budgets | Passed |
| Example Studio compilation | 11 resources compiled |
| npm dependency audit | 0 vulnerabilities |

## Visual-asset checks

`scripts/verify-canyon-textures.py` verifies:

- exact horizontal and vertical wrapping for all three water frames;
- balanced water gradient energy, preventing one dominant diagonal direction;
- restrained water luminance contrast;
- exact sandstone wrapping;
- sufficient sandstone variation at 32- and 128-pixel offsets;
- all 47 canonical Blob-47 boundary and shoreline mappings;
- transparent fully surrounded shoreline state;
- shoreline alpha-area limits;
- required rock, crack, scrub, sediment, and ruin frame groups.

## Level-structure checks

Automated tests verify:

- zero explicit water cells and one continuous water plane;
- full mission-distance terrain coverage;
- exact eight-neighbour Blob-47 masks;
- separation of continuous sandstone fill and shoreline overlay;
- four substantial islands with no one-cell island rows;
- constrained opening-mask diversity;
- sparse set-dressing density;
- presentation-only terrain data;
- the 256-pixel river and sandstone source planes.

## Runtime architecture checks

Static and unit checks verify that `TerrainRuntime`:

- supports `tileSprite`, ordinary `cells`, and `compositedCells` modes;
- creates chunk-local CanvasTextures for sandstone compositing;
- uses `destination-in` masking;
- destroys generated textures when chunks leave the active window;
- preserves the continuous source phase across 512-pixel chunks.

## Browser gate

Playwright discovered 16 configured browser executions. None reached application assertions because the audit environment lacked the pinned Chromium and WebKit binaries. The failures were browser-launch errors requesting `playwright install`, not game or Studio assertion failures. Browser execution is therefore **uncertified**, not passed.

A local browser smoke pass remains required before treating CanvasTexture compositing, mobile GPU memory, screenshot appearance, and the player shadow as fully release-certified.
