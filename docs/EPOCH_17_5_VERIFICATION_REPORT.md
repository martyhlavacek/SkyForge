# Skyforge Epoch 17.5 — Verification Report

**Version:** 0.8.5  
**Date:** 2026-07-13

## Release gates

| Command / check | Result |
|---|---|
| `npm ci` | Pass |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | 372 tests across 56 files pass |
| Production import graph | 0 cycles |
| `npm run build` | Pass |
| `npm run build:base:verify` | Pass |
| `npm run build:budget` | Pass |
| `npm run studio:example:compile` | Pass; 9 resources; deterministic fingerprint generated |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `npx playwright test --list` | 15 scenarios / 17 project executions discovered |
| Chromium Playwright execution | Blocked by environment policy before app navigation |

## Bundle-budget result

```text
Total JavaScript:          2,365,800 bytes
Total gzipped JavaScript:    606,094 bytes
Total CSS:                    36,798 bytes
Phaser vendor chunk:       1,375,726 bytes
ContentRegistry chunk:       301,241 bytes
Main application chunk:      173,343 bytes
Budget failures:                    0
```

## Added regression coverage

- Run progression restore, reward sequence, checkpoint and multiplier behavior.
- `GameScene` line/ownership architecture budget.
- Boss player-bullet and missile collider ownership and full cleanup policy.
- Studio runtime responsibility boundary.
- Debug keyboard handler cleanup.
- Asset preview stale-load invalidation.
- Production TypeScript/TSX import-cycle detection.

## Browser-suite status

The configured system Chromium launched, but navigation to `http://127.0.0.1:4173` returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` with an organizational policy page. This did not exercise Skyforge application code. WebKit was unavailable. The suite remains included and should be run in CI or locally.
