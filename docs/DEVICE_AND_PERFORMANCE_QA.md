# Skyforge Device and Performance QA Matrix

> **Epoch 17.6 status:** AI Foundry device checks are no longer release gates because that subsystem has been removed from the active application.


## Automated browser matrix

| Project | Engine | Profile | Coverage |
|---|---|---|---|
| desktop-chromium | Chromium | Desktop Chrome | Full gameplay and Studio suite |
| mobile-chromium | Chromium | Pixel 7 | Touch entry, viewport fit, frame progress, Studio layout |
| mobile-webkit | WebKit | iPhone 14 | iPhone-class viewport, touch entry, Studio layout |

Run:

```bash
npx playwright install chromium webkit
npm run test:e2e
```

## Physical-device release checks

Automation cannot validate every browser audio, controller or thermal condition. Before a tagged release, record results for:

- current iPhone Safari;
- one older supported iPhone;
- Android Chrome;
- desktop Chrome, Firefox and Safari;
- keyboard;
- Xbox-compatible controller;
- PlayStation-compatible controller where available;
- touch-only portrait play;
- Bluetooth audio route change;
- background/resume and screen lock;
- ten-minute combat session;
- Music Studio render of the largest supported composition;
- Asset Studio import of the largest supported pack.

## Build budgets

`npm run build:budget` fails when the production build exceeds:

- 3.2 MB uncompressed JavaScript total;
- 900 KB gzipped JavaScript total;
- 500 KB CSS total;
- 1.65 MB for the Phaser vendor chunk;
- 800 KB for any other JavaScript chunk.

The report is written to `dist/build-budget-report.json`.

## Runtime observations

During physical testing, capture:

- average and worst frame pacing;
- maximum active enemies and projectiles;
- memory growth after repeated mission restart;
- audio unlock and resume behaviour;
- input latency by device type;
- viewport cropping and safe-area behaviour;
- Studio horizontal overflow;
- IndexedDB persistence and quota failures.

## AI Asset Foundry device checks

For each approved production sprite:

- preview at native game scale on desktop and physical iPhone;
- test against every intended biome;
- test one, formation and stress-count views;
- verify projectile contrast and collision fairness;
- verify aircraft shadow separation and hardpoint alignment;
- confirm the processed derivative does not introduce smoothing at device scale;
- record mobile review in the candidate runtime-test report.

High-resolution source processing is an authoring-time workload and must not run during gameplay. Batch processing should move to a Worker if main-thread interaction exceeds the QA responsiveness target.
