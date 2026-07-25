# Epoch 17.2 Verification Report

**Version:** 0.8.2  
**Release type:** Security and reliability remediation

## Completed checks

| Gate | Result |
|---|---|
| TypeScript strict checking | Passed |
| ESLint | Passed |
| Vitest | 340 tests across 43 files passed |
| Package traversal negative tests | Passed |
| Safe authored-ID tests | Passed |
| Gateway Origin/Host/token/rate tests | Passed |
| Runtime bridge policy tests | Passed |
| React map-painting component test | Passed |
| React Foundry component tests | Passed |
| Root production build | Passed |
| `/skyforge/` base build | Passed |
| Build budgets | Passed |
| Example workspace release compilation | Passed |
| Offline OpenAI request-contract test | Passed |
| `npm audit --audit-level=high` | 0 vulnerabilities |

## Build measurements

- Total JavaScript: 2,333,435 bytes
- Total gzipped JavaScript: 596,773 bytes
- Total CSS: 28,706 bytes
- Phaser vendor chunk: 1,375,726 bytes
- Largest non-Phaser chunk: 299,550 bytes
- Budget failures: none

## Browser automation

Fourteen Playwright scenarios are checked into the repository and CI installs Chromium and WebKit before running them. The local release environment used for this report does not guarantee those binaries; local users can run:

```bash
npm run test:e2e:install
npm run test:e2e
```

## Provider verification limitation

The gateway's request shape is verified offline. A real paid request was not performed without a user-provided key. The opt-in command is:

```bash
SKYFORGE_LIVE_OPENAI_TEST=1 npm run test:foundry:live
```
