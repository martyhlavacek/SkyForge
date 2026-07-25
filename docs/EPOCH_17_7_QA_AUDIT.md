# Epoch 17.7 QA Audit

## Scope

This audit covers the removal of active terrain collision, the rebuilt Level 01 canyon, connected tile selection, package synchronization and release integrity.

## Automated gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | Passed | `npm ci --no-audit --no-fund --progress=false` installed 202 packages |
| Portable lockfile | Passed | no internal registry URLs |
| TypeScript strict | Passed | `tsc --noEmit` |
| ESLint | Passed | source, E2E and configuration files |
| Vitest | Passed | **361 tests across 54 files** |
| Circular source dependencies | Passed | import-graph architecture test reports zero cycles |
| Documentation evidence | Passed | README test/scenario inventory matches generated report |
| Production build | Passed | Vite root build |
| Base-path build | Passed | `/skyforge/` game, editor, Studio, music and asset resources verified |
| Bundle budgets | Passed | zero budget failures |
| Example release compiler | Passed | 9 resources, fingerprint `fnv1a-6e2094db` |
| Dependency audit | Passed | 0 vulnerabilities at all severities |
| Lock/package synchronization | Passed | revised terrain hash and 0.9.0 root versions |

## Terrain-specific regression coverage

Automated tests verify:

- `TerrainRuntime` contains no player/projectile collision resolver calls;
- all default canyon materials are visual-only;
- default collision guide damage and projectile-blocking flags are disabled;
- Level 01 has no gate/barrier objects and no terrain-state events;
- every river coordinate exists exactly once over the complete 800-row map;
- every cliff variant equals the mask implied by adjacent cliff occupancy;
- every exposed cliff has one matching rim cell with the same variant;
- the terrain map covers the complete mission scroll distance;
- water animation contains only frames 11 and 12;
- atlas hashes and Cardinal-16 frame ranges match the checked-in PNG;
- Level Studio autotiling connects to map exteriors and regenerates exposed rims.

## Build measurements

| Measure | Epoch 17.6.2 | Epoch 17.7 | Change |
| --- | ---: | ---: | ---: |
| Production JavaScript | 2,298,459 B | 2,610,443 B | +311,984 B |
| Gzipped JavaScript | 586,804 B | 613,407 B | +26,603 B |
| CSS | 30,285 B | 30,285 B | 0 B |
| Largest non-Phaser chunk | not recorded here | 617,239 B | under 800,000 B budget |
| `TerrainRuntime.ts` | 487 lines | 274 lines | −213 lines |
| TypeScript/TSX source | 27,241 lines | 27,166 lines | −75 lines |

The JavaScript increase is data-driven: Level 01 now contains an explicit full-mission, full-width river grid and twice the former row coverage. Runtime collision code itself was reduced substantially.

## Browser certification

Playwright was attempted using the installed system Chromium. Chromium launched, but navigation to `http://127.0.0.1:4173/index.html` was rejected by the execution environment with:

`net::ERR_BLOCKED_BY_ADMINISTRATOR`

This is the same loopback-policy limitation seen in earlier audits. The 14 Playwright scenarios remain present, and the obsolete gate-state scenario has been replaced with a visual-only terrain-state scenario. Browser behavior is **not certified** by this environment and must be run locally or in CI with Chromium and WebKit.

## Audit conclusion

All executable non-browser release gates pass. No Critical or High-severity defect was found in the refactor. The release is suitable for local gameplay and Level Studio review, subject to the browser and visual-art review items in the deficiency log.
