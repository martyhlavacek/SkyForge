# Skyforge Epoch 17 Verification Report

**Version:** 0.8.0  
**Date:** 2026-07-12

## Automated verification

| Check | Result |
|---|---|
| Dependency install in implementation tree | Passed |
| TypeScript strict check | Passed |
| ESLint | Passed |
| Vitest | 290 tests across 36 files passed |
| Root production build | Passed |
| `/skyforge/` base build and delivery verification | Passed |
| Build-budget gate | Passed |
| Local AI gateway syntax and health check | Passed |
| Checked-in workspace lock | Passed |
| Campaign production compiler | Passed |
| Dependency audit | 0 vulnerabilities |
| Static game, Studio, music, and asset delivery | Passed |

## Build-budget result

```text
Total JavaScript:          2,331,235 bytes
Total gzipped JavaScript:    595,614 bytes
Total CSS:                    27,082 bytes
Phaser vendor chunk:       1,375,726 bytes
Largest non-Phaser chunk:    299,550 bytes
Asset Studio chunk:          165,852 bytes
```

All values remain below the configured release limits.

## AI Asset Foundry verification

The automated and manual checks cover:

- structured asset-brief creation;
- versioned prompt compilation;
- generation and edit request contracts;
- manual ChatGPT-output import lineage;
- candidate states and master selection;
- non-destructive pixel-processing primitives;
- runtime-test and approval gates;
- stale-safe assignment transactions;
- Asset Pack semantic validation;
- Git-folder serialization of every Foundry record group;
- resource byte-count and SHA-256 validation;
- dead candidate-resource elimination during release compilation;
- gateway loopback binding, origin restrictions, request limits, and fixed provider endpoints.

The local gateway health endpoint was exercised without an API key and correctly reported manual-only readiness. A paid external image-generation request was not executed in this environment because no user API credential was provided. The request construction and validation paths are covered by tests; an authenticated smoke generation remains a user-controlled local test.

## Browser verification

Playwright discovers 14 scenarios across desktop Chromium, Pixel 7 Chromium, and iPhone 14 WebKit. The Asset Studio scenario includes the Foundry subtab and candidate workflow.

Execution was attempted, but this sandbox does not contain Playwright's Chromium or WebKit binaries. Failure occurred before browser launch and before any application assertion. CI and local instructions install the required browsers.

## Security verification

- No OpenAI credential appears in browser code, package data, checked examples, local storage, or IndexedDB.
- `.env.local` is ignored and the browser never receives `OPENAI_API_KEY`.
- The gateway binds to loopback by default and enforces an origin allow-list.
- Provider host and generation/edit endpoints are fixed server-side.
- Imported image types are allow-listed.
- Package content remains declarative and data-only.
- Unsafe executable URI schemes remain rejected.
- No imported HTML, plug-in, script, shell command, `eval`, or `new Function` path was added.
- `npm audit --audit-level=high` reports zero vulnerabilities at all severities.

## Release note

Epoch 17 is approved for a controlled Canyon vertical-slice art-production exercise. Mass campaign generation should follow only after the player aircraft, enemy fighter, tank, turret, projectile, explosion, canyon tile family, and separate aircraft shadows have passed desktop and physical-iPhone review.
