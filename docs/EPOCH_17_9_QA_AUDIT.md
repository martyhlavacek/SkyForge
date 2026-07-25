# Epoch 17.9 QA Audit

**Release:** 0.9.1  
**Date:** 2026-07-14

## Result

The non-browser release gate passed. Browser automation remains uncertified because the audit environment does not contain the required Playwright Chromium binary.

## Automated evidence

| Gate | Result |
|---|---|
| Portable npm lockfile | Passed |
| Clean dependency installation | Passed |
| TypeScript strict checking | Passed |
| ESLint | Passed |
| Vitest | 374 tests across 55 files passed |
| Source dependency cycles | 0 |
| Canyon texture verification | Passed |
| Root production build | Passed |
| `/skyforge/` deployment build | Passed |
| Bundle budgets | Passed |
| Example Studio compilation | 10 resources passed |
| npm audit | 0 vulnerabilities |

## Texture and topology checks

`npm run terrain:verify` verifies:

- opposite edges of both 128×128 water animation frames match exactly;
- the reconstructed 128×128 sandstone metatile wraps correctly;
- all 47 canonical Blob-47 masks exist for sandstone boundaries;
- all 47 corresponding shoreline overlays exist;
- shoreline frames preserve transparent non-terrain regions;
- atlas dimensions and resource hashes match the manifest.

Unit coverage also verifies:

- Blob-47 normalization reduces the 256 theoretical masks to 47 canonical states;
- diagonal connections require their supporting cardinal neighbours;
- runtime frame selection uses Blob-47 mappings;
- the water animation phase is synchronized across neighbouring world positions;
- the map contains no explicit river cells;
- boundary and shoreline layers have one-to-one masks;
- early-map island and bend geometry is present;
- the player shadow follows the player lifecycle.

## Production bundle

The measured production output remained within all configured budgets:

- JavaScript: 2,296,104 bytes;
- gzipped JavaScript: 585,603 bytes;
- CSS: 30,285 bytes.

## Browser status

Playwright enumerated the desktop Chromium scenarios but could not launch them because the browser executable was absent from the environment cache. The failure occurred before page navigation or application assertions. This release therefore makes no browser-pass claim.

Required external certification command:

```bash
npm run test:e2e:install
npm run test:e2e -- --project=desktop-chromium
```

A normal local visual check should specifically inspect:

1. no visible 32-pixel water borders;
2. no repeated cliff-arch stamp in land interiors;
3. shoreline continuity through concave corners, convex corners, islands, and peninsulas;
4. shadow visibility over both water and sandstone;
5. stable terrain scrolling with no black seams.
