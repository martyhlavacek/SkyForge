# Skyforge Epoch 17.4 Verification Report

**Date:** 2026-07-13  
**Version:** 0.8.4  
**Release focus:** Default image-backed canyon tileset

## Release result

Epoch 17.4 passes the available code, content, atlas, package, build, budget and dependency gates. The default Canyon atlas is reproduced byte-for-byte from the retained source master and is referenced consistently by the biome registry, Level Studio, Phaser runtime, built-in Asset Pack and checked-in collaboration examples.

## Automated gates

| Gate | Result |
|---|---|
| Clean dependency install | Passed during project preparation |
| TypeScript strict compilation | Passed |
| ESLint | Passed |
| Vitest | **359 tests across 49 files passed** |
| README evidence drift check | Passed |
| Foundry gateway syntax and offline provider contract | Passed |
| Root Vite production build | Passed |
| `/skyforge/` base-path build | Passed |
| Base-build asset copying | Passed for game, Studio, music and canyon terrain resources |
| Build budgets | Passed; no failures |
| Example workspace lock generation | Passed |
| Example production compilation | Passed; 9 live resources |
| Dependency audit | Passed; 0 vulnerabilities |
| Atlas reproducibility | Passed; all generated hashes unchanged after rebuild |

## New focused coverage

- Terrain and props PNG dimensions, byte counts and SHA-256 hashes.
- Complete Cardinal-16 mask-to-frame assignment for masks 0–15.
- Tileset URI safety, frame bounds, duplicate material detection and animation metadata.
- Stable coordinate-based frame selection.
- Cardinal variant priority over static material variation.
- Time-based animated terrain frame resolution.
- Atlas-backed Level Studio canvas drawing.
- Existing package validation against the new biome tileset metadata.
- Browser scenario for default atlas network loading and material-palette visibility.

## Atlas evidence

| Artifact | Dimensions / role | Bytes | SHA-256 |
|---|---:|---:|---|
| `art-source/skyforge_canyon_master.png` | Retained source master | 3,031,541 | `e8718a5f5590aa96f0ce78b164cf0333bedf663d5285d53d859efb67bf95ef6e` |
| `public/assets/terrain/skyforge_canyon_terrain.png` | 512×256; 128 frames | 322,210 | `98074033fceb7407b2058d0b05b3ed1a92d84d89d76580f7f907badc1b448413` |
| `public/assets/terrain/skyforge_canyon_props.png` | 512×128; 64 frames | 125,820 | `7f8f9dc32631f257a7da8a3508f683277c045c38945c4d550c08b94b03603931` |
| `public/assets/terrain/skyforge_canyon_tileset.json` | Semantic frame manifest | 4,725 | `f8d8eb1f8d0222a8b739f19fa52e12e942b7a84825beb2c6264c609bf11c0489` |

The normalization script was executed twice without source changes. All three generated artifact hashes remained identical.

## Build-budget evidence

| Measurement | Observed | Budget |
|---|---:|---:|
| Total JavaScript | 2,359,326 bytes | 3,200,000 bytes |
| Total gzipped JavaScript | 604,034 bytes | 900,000 bytes |
| Total CSS | 36,798 bytes | 500,000 bytes |
| Phaser vendor chunk | 1,375,726 bytes | 1,650,000 bytes |
| Largest non-Phaser chunk | 301,241 bytes | 800,000 bytes |

## Browser automation status

The repository contains **15 authored Playwright scenarios**, producing **17 configured browser-project executions** across desktop Chromium, mobile Chromium and mobile WebKit. The new scenario verifies that the Level Studio requests `skyforge_canyon_terrain.png` and exposes the image-backed atlas in the material browser.

The browser assertions could not execute in this container because the required Playwright browser binary is absent. An attempted installation failed because `cdn.playwright.dev` could not be resolved (`EAI_AGAIN`). The scenarios are checked in and CI installs Chromium and WebKit before running them.

Run locally with:

```bash
npm run test:e2e:install
npm run test:e2e
```

## Manual visual checks still required

- Confirm pixel-perfect, non-smoothed atlas rendering in Chrome and Safari on macOS.
- Paint long cliff and river strokes at several editor zoom levels.
- Compare the same cells between editor and runtime.
- Review water animation cadence and shoreline readability while scrolling.
- Review Cardinal-16 seams and the metal-platform demonstration at full runtime speed.
- Review the generated art for final production cleanup, repetition and directional lighting consistency.

## Deferred by design

Epoch 17.4 does not claim automatic Blob-47 or true dual-grid rendering. Organic frames are included as authored source material for the next rule-engine revision. Props are registered in Asset Studio but are not yet exposed in the Level Studio stamp/prefab palette.
