# Skyforge Epoch 17.5 — QA Audit

**Audit type:** Post-refactor independent-style verification  
**Artifact under review:** Skyforge 0.8.5 source tree derived from Epoch 17.4  
**Date:** 2026-07-13

## Executive assessment

Epoch 17.5 materially improves runtime maintainability without changing package or save formats. The central scene is no longer a 1,682-line god class, the production dependency graph is acyclic, and several lifecycle defects were corrected while extracting responsibilities.

No High-severity deficiency was identified in the refactored tree. All mechanically executable release gates passed. Browser scenarios were discovered and launched with system Chromium, but the execution environment blocks browser access to `127.0.0.1` with `ERR_BLOCKED_BY_ADMINISTRATOR`; this is an environmental verification limitation, not an application assertion of success.

## Audit method

- Fresh dependency installation.
- Strict TypeScript compilation.
- ESLint across source, E2E and build configuration.
- Complete Vitest suite.
- Production root-base and `/skyforge/`-base builds.
- Bundle-budget measurement.
- Example Studio workspace compilation and lock verification.
- Dependency vulnerability audit.
- Production import-graph cycle analysis.
- Static source hygiene and largest-file review.
- Playwright scenario enumeration and attempted Chromium execution.
- Comparison against the independently measured Epoch 17.4 baseline.

## Mechanically verified results

| Gate | Result |
|---|---|
| TypeScript strict | Pass |
| ESLint | Pass |
| Vitest | 372 tests / 56 files pass |
| Production build | Pass |
| `/skyforge/` base build | Pass |
| Bundle budget | Pass |
| Example workspace compile | Pass; 9 resources |
| Dependency audit | 0 vulnerabilities |
| Production import cycles | 0 |
| Source hygiene | 0 TODO/FIXME, `@ts-ignore`, `eslint-disable`, or `console.log` in production source |
| Playwright discovery | 15 authored scenarios / 17 project executions |
| Playwright execution | Environment blocked loopback navigation |

## Bundle comparison

| Measure | Epoch 17.4 baseline | Epoch 17.5 | Difference |
|---|---:|---:|---:|
| Total JS | 2,359,326 B | 2,365,800 B | +6,474 B (+0.27%) |
| Gzipped JS | 604,034 B | 606,094 B | +2,060 B (+0.34%) |
| CSS | 36,798 B | 36,798 B | unchanged |
| Main application chunk | 166,869 B | 173,343 B | +6,474 B |

The increase is the cost of the new runtime boundaries and Studio host adapters. It remains far below the existing budget, but it exposes an optimization opportunity: Studio-only simulation code is still statically included in the normal game entry.

## Static architecture observations

- Production source: 146 TypeScript/TSX files and approximately 27.2k lines.
- `GameScene` is 635 lines with 38 imports; substantially improved, though still a high fan-out composition root.
- Largest remaining modules are `StudioApp.tsx` (1,530), `AssetStudioWorkspace.tsx` (1,246), `BuiltInPackages.ts` (1,099), `MusicStudioWorkspace.tsx` (999), and `StudioRuntimeController.ts` (749).
- Only 4 of 17 production TSX modules have direct component-test coverage; pure functions and package compilers are better covered than interactive workspaces.

## Strengths preserved

- Transactional economy and checkpoint rollback behavior.
- Safe package IDs and path containment.
- Foundry Origin/Host/token/rate controls.
- Deterministic package locks and release compilation.
- Image-backed canyon tileset and reproducible atlas pipeline.
- Strict source hygiene and bounded bundles.
- No schema or save migration required by the refactor.

## Verification limitation

Playwright successfully found all 17 configured executions and Chromium could launch from `/usr/bin/chromium`. Every navigation was intercepted by an organizational browser policy page stating that `127.0.0.1` is blocked. Consequently, the audit does not claim browser-level behavior passed in this environment. CI or a local developer machine must execute:

```bash
npm run test:e2e:install
npm run test:e2e
```
