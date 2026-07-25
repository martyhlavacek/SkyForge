# Epoch 17.6 Deficiency Log

**Release:** SkyForge 0.8.6  
**Date:** 2026-07-13

## Severity summary

| Severity | Open items |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 5 |
| Low | 3 |

## Medium deficiencies

### D-17.6-01 — Browser release gate is not certified

**Status:** Open  
**Area:** QA / release engineering

The 16 configured Playwright executions could not launch because browser binaries were unavailable and the audit container could not download them. The application was not reached.

**Risk:** UI regressions in Chromium, mobile Chromium or mobile WebKit may remain undetected by this audit.

**Recommendation:** make `playwright install --with-deps chromium webkit` and `npm run test:e2e` mandatory in network-enabled CI, retaining screenshots/traces as release evidence.

### D-17.6-02 — Level Studio remains iframe-coupled

**Status:** Open  
**Area:** architecture / authoring workflow

The Level workspace embeds `editor.html` in an iframe and exchanges packages through `postMessage` and request IDs.

**Risk:** duplicated state, asynchronous synchronization complexity, harder component testing and limited direct integration with tuning/runtime selections.

**Recommendation:** converge Level Studio and Game Design Studio on a shared React/project store, then replace package round-tripping with typed in-process commands.

### D-17.6-03 — Asset Studio is still a large component

**Status:** Open  
**Area:** maintainability

`AssetStudioWorkspace.tsx` remains 1,235 lines after Foundry removal.

**Risk:** higher review cost and increased coupling between asset inventory, preview, assignment and tileset workflows.

**Recommendation:** split inventory, preview, assignment and tileset panels into independently tested components and move mutations into focused hooks/services.

### D-17.6-04 — Studio runtime facade remains oversized

**Status:** Open  
**Area:** game/runtime architecture

`StudioRuntimeController.ts` remains 749 lines and is referenced by the ordinary game scene.

**Risk:** authoring/debug concerns remain coupled to runtime lifecycle and enlarge the regression surface for gameplay changes.

**Recommendation:** separate transport/snapshot, telemetry and transient-tuning adapters behind a small optional Studio bridge loaded only for Studio sessions.

### D-17.6-05 — Workspace still requires a music package

**Status:** Open  
**Area:** package model

`StudioWorkspaceSchema` requires level, tuning, music and asset references even though music authoring is now external and some development builds may intentionally be silent.

**Risk:** teams must maintain a placeholder music package when testing silent or externally integrated builds.

**Recommendation:** define an explicit silent music package or introduce an optional music reference in a future schema version with a migration and compiler policy.

## Low deficiencies

### D-17.6-06 — Legacy authoring fields remain in package schemas

**Status:** Accepted compatibility debt

Music instrument/composition fields and Foundry arrays remain parseable to preserve existing packages.

**Risk:** schema surface remains larger than the active Studio feature set.

**Recommendation:** retain through the current compatibility window; deprecate formally before any schema-v3 removal.

### D-17.6-07 — Focused workspaces still have two large host modules

**Status:** Open

`StudioApp.tsx` is 816 lines and `FocusedStudioWorkspaces.tsx` is 721 lines.

**Risk:** the main orchestration layer still owns substantial UI and message-bridge behavior.

**Recommendation:** extract file import/export, runtime bridge and package orchestration into tested hooks before adding major mechanics tooling.

### D-17.6-08 — Physical-device and controller checks remain manual

**Status:** Open

Automated emulation does not replace physical iPhone/iPad, controller, audio-unlock, resize/letterbox and sustained-FPS checks.

**Recommendation:** maintain a concise target-device matrix and record results for milestone releases.

## Recommended implementation order

1. Restore browser CI certification.
2. Remove the Level Studio iframe boundary and add play-from-selection/hot reload.
3. Decompose Asset Studio and the Studio runtime facade.
4. Improve level-editing throughput: dirty-region autotiling, encounter/timeline linking and validation feedback.
5. Revisit optional/silent music only when the next package schema is planned.
