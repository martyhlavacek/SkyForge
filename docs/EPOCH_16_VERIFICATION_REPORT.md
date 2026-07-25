# Skyforge Epoch 16 Verification Report

**Version:** 0.7.0  
**Date:** 2026-07-12

## Automated verification

| Check | Result |
|---|---|
| Clean dependency install | Passed |
| TypeScript strict check | Passed |
| ESLint | Passed |
| Vitest | 284 tests across 35 files passed |
| Root production build | Passed |
| `/skyforge/` base build | Passed |
| Build-budget gate | Passed |
| Checked-in workspace lock | Passed |
| Campaign-scale production compiler | Passed |
| Dependency audit | 0 high-severity vulnerabilities |
| ZIP integrity | Passed after clean archive extraction |

## Build-budget result

At the implementation review build:

```text
Total JavaScript:         2,293,345 bytes
Total gzipped JavaScript:   585,797 bytes
Total CSS:                   24,725 bytes
Phaser vendor chunk:      1,375,726 bytes
Largest non-Phaser chunk:   299,550 bytes
```

All values are below the configured release thresholds.

## Package/compiler verification

The automated suite verifies:

- schema-v1 package and workspace migration;
- lock determinism and drift detection;
- all four folder-mode round trips;
- binary-resource preservation;
- deterministic package change reports;
- review-comment persistence;
- blocking release comments;
- live-resource hashing;
- dead-resource removal;
- lock enforcement.

The checked-in campaign workspace compiled five live music resources into content-addressed output and emitted sanitized package JSON, workspace, lock and release manifest.

## Browser verification

Playwright projects are configured for:

- desktop Chromium — complete existing browser suite;
- Pixel 7 Chromium — mobile touch/layout suite;
- iPhone 14 WebKit — mobile touch/layout suite.

The suite discovers 14 browser scenarios across these projects. Execution was attempted in the release workspace, but the required Playwright Chromium and WebKit binaries are not installed in this sandbox. The failure occurred before application launch; it is not a game-test assertion failure. CI installs Chromium and WebKit and executes the matrix. Physical-device checks remain manual and are listed in `DEVICE_AND_PERFORMANCE_QA.md`.

## Additional release checks

- Root production output contains non-empty game, Level Studio, Game Design Studio, Vite manifest, adaptive-music, and split-vendor artifacts.
- Node release scripts pass syntax checks.
- The checked-in Music Pack survives semantic unpack/repack round-trip, and repeated packing of the same folder is byte-deterministic.
- Security scanning found no package-provided executable-content path; the only `javascript:` occurrence is the intentional rejection test.
- `npm audit --audit-level=high` reports zero vulnerabilities at every severity.
